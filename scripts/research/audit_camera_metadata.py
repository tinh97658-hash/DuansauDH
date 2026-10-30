"""Audit manifests, filename camera tokens and frozen episode composition.

No images/embeddings are decoded, no scores evaluated, no thresholds fitted.
Camera tokens are not assumed to be globally unique physical camera IDs.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path, PurePosixPath
import random
import re
import sys
import zipfile


def original_name(path):
    name = PurePosixPath(path.replace("\\", "/")).name
    return name.split("__", 1)[-1]


def camera_token(path):
    match = re.search(r"_cam(\d+)_", original_name(path))
    return "cam" + match.group(1) if match else ""


def manifest_stats(rows):
    grouped = defaultdict(list)
    paths = [r["image_path"].replace("\\", "/") for r in rows]
    for r in rows:
        grouped[r["person_id"]].append(r)
    known_sets = [{r["camera_id"] for r in members if r["camera_id"]} for members in grouped.values()]
    return {
        "images": len(rows), "identities": len(grouped),
        "duplicate_paths": len(paths) - len(set(paths)),
        "missing_camera": sum(not r["camera_id"] for r in rows),
        "missing_session": sum(not r["session_id"] for r in rows),
        "camera_parser_mismatches": sum(camera_token(r["image_path"]) != r["camera_id"] for r in rows),
        "camera_token_counts": dict(Counter(r["camera_id"] or "MISSING" for r in rows)),
        "role_counts": dict(Counter(r["role"] for r in rows)),
        "missing_camera_by_role": dict(Counter(r["role"] for r in rows if not r["camera_id"])),
        "identities_with_at_least_two_known_tokens": sum(len(s) >= 2 for s in known_sets),
        "identities_with_no_known_token": sum(not s for s in known_sets),
    }


def token_relation(a, b):
    if not a or not b:
        return "missing_token"
    return "same_token" if a == b else "different_tokens"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--research-root", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    root = args.research_root.resolve()
    args.out.mkdir(parents=True, exist_ok=False)
    sys.path.insert(0, str(root))
    from src.data.manifest import read_manifest
    from src.data.splits import build_episode, group_by_person
    subset = root / "data/processed/qmul_subset_samedomain"
    inputs = [subset / f"manifest_{split}.csv" for split in ["dev", "test"]]
    stats_path = subset / "subset_stats.json"
    inputs.append(stats_path)
    settings = json.loads(stats_path.read_text(encoding="utf-8"))
    if settings["dev_source"] != "test":
        raise ValueError("This audit pins the stored same-domain test-source subset")
    rows = {}
    for split in ["dev", "test"]:
        with (subset / f"manifest_{split}.csv").open(encoding="utf-8", newline="") as f:
            rows[split] = list(csv.DictReader(f))
    stats = {s: manifest_stats(r) for s, r in rows.items()}
    identity_overlap = set(r["person_id"] for r in rows["dev"]) & set(r["person_id"] for r in rows["test"])
    if identity_overlap or any(s["duplicate_paths"] or s["camera_parser_mismatches"] for s in stats.values()):
        raise ValueError("Manifest identity/path/parser integrity check failed")
    archive = root / settings["source_zip"].replace("\\", "/")
    prefixes = {"gallery": "gallery", "mated": "mated_probe", "nonmated": "unmated_probe"}
    matched, missing = 0, 0
    with zipfile.ZipFile(archive) as z:
        readme = z.read("QMUL-SurvFace/readme.txt")
        for split_rows in rows.values():
            for row in split_rows:
                member = "QMUL-SurvFace/Face_Identification_Test_Set/" + prefixes[row["role"]] + "/" + original_name(row["image_path"])
                try:
                    z.getinfo(member)
                    matched += 1
                except KeyError:
                    missing += 1
    if missing:
        raise ValueError("Manifest source members missing from pinned archive")
    episode_rows, reuse_rows = [], []
    for split in ["dev", "test"]:
        records = read_manifest(subset / f"manifest_{split}.csv")
        lookup = {r["image_path"]: r for r in rows[split]}
        grouped = group_by_person(records)
        pool_base = sorted(pid for pid, records in grouped.items() if len(records) >= 3)
        unknown = sorted(pid for pid, records in grouped.items() if len(records) < 3)
        observed = {k: [] for k in ["gallery", "mated", "unknown"]}
        for seed in range(2026, 2031):
            pool = list(pool_base)
            random.Random(f"{seed}:{split}-pool").shuffle(pool)
            ep = build_episode(records, pool[:300], unknown + pool[300:], name=f"{split}-N300", seed=seed,
                               max_mated_per_id=2, max_nonmated_per_id=1)
            gallery = {r.person_id: r for r in ep.gallery}
            pairs = Counter()
            role_pairs = Counter()
            for probe in ep.mated_probes:
                mate = gallery[probe.person_id]
                pairs[token_relation(mate.camera_id, probe.camera_id)] += 1
                role_pairs[(lookup[mate.image_path]["role"], lookup[probe.image_path]["role"])] += 1
            counts = {
                "gallery_source_role": Counter(lookup[r.image_path]["role"] for r in ep.gallery),
                "mated_source_role": Counter(lookup[r.image_path]["role"] for r in ep.mated_probes),
                "unknown_source_role": Counter(lookup[r.image_path]["role"] for r in ep.nonmated_probes),
                "true_mate_camera_relation": pairs,
                "true_mate_source_role_pair": Counter({a + "->" + b: n for (a, b), n in role_pairs.items()}),
            }
            for axis, values in counts.items():
                for category, count in sorted(values.items()):
                    episode_rows.append({"split": split, "seed": seed, "n_gallery": 300,
                                         "axis": axis, "category": category, "count": count})
            for key, values in [("gallery", ep.gallery), ("mated", ep.mated_probes), ("unknown", ep.nonmated_probes)]:
                observed[key].extend(values)
        for role, records in observed.items():
            counts = Counter(r.image_path for r in records)
            reuse_rows.append({"split": split, "episode_role": role, "appearances": len(records),
                               "unique_images": len(counts), "unique_identities": len(set(r.person_id for r in records)),
                               "images_seen_in_multiple_seeds": sum(n > 1 for n in counts.values()),
                               "max_seeds_per_image": max(counts.values())})
    for name, data in [("episode_metadata_counts.csv", episode_rows), ("episode_reuse.csv", reuse_rows)]:
        with (args.out / name).open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(data[0]))
            w.writeheader()
            w.writerows(data)
    for rel in ["scripts/prepare_qmul_subset.py", "src/data/splits.py", "src/data/manifest.py"]:
        inputs.append(root / rel)
    result = {"phase": "metadata_only", "model_inference": False, "score_evaluation": False,
              "physical_camera_namespace_verified": False, "sessions_available": False,
              "subset_source": settings["dev_source"], "split_stats": stats,
              "dev_test_identity_overlap": len(identity_overlap), "archive_members_matched": matched,
              "archive_members_missing": missing, "archive_readme_sha256": hashlib.sha256(readme).hexdigest(),
              "archive_readme_camera_schema": "[PersonID]_[CameraID]_[ImageName].jpg",
              "archive_readme_missing_provenance": "No verified global physical-camera namespace or session/track linkage established by this audit",
              "source_hashes": {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
              "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (args.out / "metadata_audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"split_stats": stats, "source_members_matched": matched, "identity_overlap": len(identity_overlap)}, indent=2))


if __name__ == "__main__":
    main()

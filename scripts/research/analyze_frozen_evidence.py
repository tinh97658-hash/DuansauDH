"""Post-hoc analysis of cached embeddings; no model inference or cutoff fitting.

Run with the research repository's Python environment. Existing source artifacts
are read only. Outputs must use a new directory. Bootstrap uncertainty conditions
on the observed galleries, embeddings, policies and episode seeds.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import numpy as np


def decomposition(correct, accepted):
    correct, accepted = np.asarray(correct), np.asarray(accepted)
    if correct.dtype != bool or accepted.dtype != bool or correct.ndim != 1 or correct.shape != accepted.shape or not len(correct):
        raise ValueError("Need nonempty paired Boolean vectors")
    n = len(correct)
    counts = {
        "n_mated": n, "rank_wrong": int((~correct).sum()),
        "correct_rank_rejected": int((correct & ~accepted).sum()),
        "correct_rank_accepted": int((correct & accepted).sum()),
        "wrong_rank_accepted": int((~correct & accepted).sum()),
        "wrong_rank_rejected": int((~correct & ~accepted).sum()),
    }
    assert counts["rank_wrong"] + counts["correct_rank_rejected"] + counts["correct_rank_accepted"] == n
    return {**counts, "rank1": float(correct.mean()),
            "fnir": (counts["rank_wrong"] + counts["correct_rank_rejected"]) / n,
            "ranking_error_rate": counts["rank_wrong"] / n,
            "correct_rank_rejection_rate": counts["correct_rank_rejected"] / n}


def wilson(k, n):
    """95% pointwise interval, conditional on this gallery; not pooled seeds."""
    if not 0 <= k <= n or n < 1:
        raise ValueError("Invalid event counts")
    z = 1.959963984540054
    p, d = k / n, 1 + z * z / n
    center = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0., center - half), min(1., center + half)


def aurc(correct, key, weights=None, *, tie_average=False):
    """Low key first. Integer frequency weights resample whole identities.

    tie_average integrates expected prefix error over uniform within-tie orders,
    including the multiplicities from resampling. Stable mode reproduces legacy
    sorting; neither mode selects any decision threshold.
    """
    correct, key = np.asarray(correct, dtype=bool), np.asarray(key, dtype=float)
    if correct.ndim != 1 or key.shape != correct.shape or not len(correct) or not np.isfinite(key).all():
        raise ValueError("Invalid correctness/key vectors")
    w = np.ones(len(correct), dtype=np.int64) if weights is None else np.asarray(weights)
    if w.shape != correct.shape or np.any(w < 0) or not np.all(w == np.floor(w)) or not w.sum():
        raise ValueError("Need nonnegative integer weights with positive total")
    order = np.argsort(key, kind="stable")
    c, k, w = correct[order], key[order], w[order].astype(np.int64)
    if not tie_average:
        errors = np.repeat((~c).astype(float), w)
        return float(np.mean(np.cumsum(errors) / np.arange(1, len(errors) + 1)))
    start = np.r_[0, np.flatnonzero(k[1:] != k[:-1]) + 1]
    sizes = np.add.reduceat(w, start)
    mistakes = np.add.reduceat(w * (~c), start)
    valid = sizes > 0
    sizes, mistakes = sizes[valid], mistakes[valid]
    end_n, end_e = np.cumsum(sizes), np.cumsum(mistakes)
    prior_n, prior_e = end_n - sizes, end_e - mistakes
    harmonics = np.r_[0., np.cumsum(1 / np.arange(1, int(w.sum()) + 1))]
    rates = mistakes / sizes
    total = rates * sizes + (prior_e - rates * prior_n) * (harmonics[end_n] - harmonics[prior_n])
    return float(total.sum() / w.sum())


def paired_aurc_bootstrap(episodes, *, replicates=2000, seed=2026, tie_average=False):
    if replicates < 100 or not episodes:
        raise ValueError("Need episodes and at least 100 bootstrap replicates")
    ids = sorted(set(str(pid) for e in episodes for pid in e["ids"]))
    positions = {pid: i for i, pid in enumerate(ids)}
    mapped = [np.array([positions[str(pid)] for pid in e["ids"]]) for e in episodes]
    # One draw per identity across ALL episodes and ALL compared policies.
    draws = np.random.default_rng(seed).multinomial(len(ids), np.full(len(ids), 1 / len(ids)), size=replicates)
    policies = ["gap", "min_side", "score", "random_reference"]
    pairs = [("gap", "score"), ("min_side", "score"), ("gap", "random_reference"),
             ("min_side", "random_reference"), ("score", "random_reference")]

    def measure(weights):
        values = {p: [] for p in policies}
        for e, w in zip(episodes, weights):
            if not w.sum():
                raise ValueError("Resample has an empty episode")
            for policy in policies[:-1]:
                values[policy].append(aurc(e["correct"], e[policy], w, tie_average=tie_average))
            values["random_reference"].append(float(np.average(~e["correct"], weights=w)))
        return {p: float(np.mean(v)) for p, v in values.items()}

    point = measure([np.ones(len(e["ids"]), dtype=np.int64) for e in episodes])
    samples = {pair: [] for pair in pairs}
    for draw in draws:
        values = measure([draw[index] for index in mapped])
        for a, b in pairs:
            samples[(a, b)].append(values[a] - values[b])
    return [{"left": a, "right": b, "left_aurc": point[a], "right_aurc": point[b],
             "difference": point[a] - point[b],
             "ci_low": float(np.percentile(samples[(a, b)], 2.5)),
             "ci_high": float(np.percentile(samples[(a, b)], 97.5)),
             "unique_identities": len(ids), "n_episodes": len(episodes), "replicates": replicates,
             "tie_handling": "expected_within_ties" if tie_average else "legacy_stable"} for a, b in pairs]


def write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--research-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--replicates", type=int, default=2000)
    args = parser.parse_args()
    root = args.research_root.resolve()
    if args.replicates < 100:
        raise SystemExit("At least 100 replicates required")
    args.out.mkdir(parents=True, exist_ok=False)
    sys.path[:0] = [str(root), str(root / "scripts")]
    from run_b0 import load_embeddings, make_records, transform_quality, score_episode
    from analyze_risk_coverage import side_map, pair_gap, pair_min_side
    from src.data.splits import group_by_person, build_episode

    inputs = []
    def source(rel):
        p = root / rel.replace("\\", "/")
        if not p.resolve().is_relative_to(root):
            raise ValueError("Input outside research root")
        if p not in inputs:
            inputs.append(p)
        return p

    archived = json.loads(source("outputs/risk_coverage_qmul/summary.json").read_text(encoding="utf-8"))
    for key in ["embeddings", "dev_manifest", "test_manifest"]:
        source(archived[key])
    with source("outputs/risk_coverage_qmul/openset_curves.csv").open(encoding="utf-8", newline="") as f:
        frozen_rows = [r for r in csv.DictReader(f) if r["n_gallery"] == "300" and
                       (r["policy"] == "base" or r["coverage_target"] == "0.6")]
    with source("outputs/risk_coverage_qmul/aurc.csv").open(encoding="utf-8", newline="") as f:
        frozen_aurc = [r for r in csv.DictReader(f) if r["n_gallery"] == "300"]
    embeddings, quality, _ = load_embeddings(source(archived["embeddings"]))
    side_lookup = side_map(source(archived["embeddings"]))
    records = {split: make_records(source(archived[f"{split}_manifest"]), embeddings, quality) for split in ["dev", "test"]}
    # Do not silently accept a subset caused by missing cached embeddings.
    from src.data.manifest import read_manifest
    for split in records:
        if len(records[split]) != len(read_manifest(source(archived[f"{split}_manifest"]))):
            raise ValueError("Missing cached embeddings")
    logq = np.array([np.log1p(r.quality or 0.) for r in records["dev"]])
    records = {split: transform_quality(rows, float(logq.mean()), float(logq.std())) for split, rows in records.items()}
    all_counts, comparisons, parity = [], [], []
    for split in ["dev", "test"]:
        grouped = group_by_person(records[split])
        eligible = sorted(pid for pid, rows in grouped.items() if len(rows) >= 3)
        unknown = sorted(pid for pid, rows in grouped.items() if len(rows) < 3)
        episodes = []
        for seed in archived["seeds"]:
            pool = list(eligible)
            random.Random(f"{seed}:{split}-pool").shuffle(pool)
            episode = build_episode(records[split], pool[:300], unknown + pool[300:],
                                    name=f"{split}-N300", seed=seed, max_mated_per_id=2, max_nonmated_per_id=1)
            scores = score_episode(episode, embeddings)
            m, u = scores.mated(), scores.nonmated()
            correct = m.person_ids == m.top1_ids
            gallery_side = {r.person_id: side_lookup[r.image_path] for r in episode.gallery}
            gaps, sizes = pair_gap(m), pair_min_side(m, gallery_side, side_lookup)
            ugaps, usizes = pair_gap(u), pair_min_side(u, gallery_side, side_lookup)
            values = {"ids": m.person_ids, "correct": correct, "gap": gaps, "min_side": -sizes, "score": -m.scores1}
            episodes.append(values)
            for policy in ["gap", "min_side", "score"]:
                legacy = aurc(correct, values[policy])
                old = next(r for r in frozen_aurc if r["split"] == split and int(r["seed"]) == seed and r["policy"] == policy)
                if not np.isclose(legacy, float(old["aurc"]), atol=5e-7, rtol=0):
                    raise ValueError(f"AURC parity failed: {split}/{seed}/{policy}")
                parity.append({"split": split, "seed": seed, "policy": policy, "aurc": legacy})
            for old in [r for r in frozen_rows if r["split"] == split and int(r["seed"]) == seed]:
                policy, tau, q = old["policy"], float(old["score_threshold"]), float(old["quality_threshold"])
                keep_m, keep_u = np.ones(len(correct), dtype=bool), np.ones(len(u.scores1), dtype=bool)
                if policy == "gap":
                    keep_m, keep_u = gaps <= q, ugaps <= q
                elif policy == "min_side":
                    keep_m, keep_u = sizes >= q, usizes >= q
                accepted = (m.scores1 >= tau) & keep_m
                d = decomposition(correct, accepted)
                fp = int(((u.scores1 >= tau) & keep_u).sum())
                if not np.isclose(d["fnir"], float(old["overall_fnir"]), atol=5e-7, rtol=0) or not np.isclose(fp / len(u.scores1), float(old["fpir"]), atol=5e-7, rtol=0):
                    raise ValueError(f"Operating point parity failed: {split}/{seed}/{policy}")
                low, high = wilson(fp, len(u.scores1))
                all_counts.append({"split": split, "seed": seed, "n_gallery": 300, "policy": policy,
                                   "score_threshold_frozen": tau, **d, "false_identifications": fp,
                                   "n_unknown": len(u.scores1), "fpir": fp / len(u.scores1),
                                   "fpir_pointwise_wilson_low": low, "fpir_pointwise_wilson_high": high})
        for tie_average in [False, True]:
            rows = paired_aurc_bootstrap(episodes, replicates=args.replicates, tie_average=tie_average)
            comparisons.extend({"split": split, "n_gallery": 300, **r} for r in rows)
        print(f"{split}: cached-score parity passed; paired bootstrap complete", flush=True)
    write_csv(args.out / "fnir_decomposition.csv", all_counts)
    write_csv(args.out / "paired_aurc_ci.csv", comparisons)
    metadata = {"phase": "posthoc_cached_embedding_analysis", "new_model_inference": False,
                "new_training": False, "cutoffs_refitted": False, "research_root": str(root),
                "n_gallery": 300, "bootstrap_seed": 2026, "parity_aurc_checks": len(parity),
                "parity_operating_point_checks": len(all_counts),
                "bootstrap_scope": "identity-cluster paired across fixed episodes; galleries/model/cutoffs fixed; no refit; pointwise percentile CIs; not multiplicity adjusted",
                "random_reference": "expected AURC of uniform random probe ordering equals full-coverage error; not simulated identity-block random ordering",
                "source_hashes": {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}}
    metadata["source_hashes"].update({rel: hashlib.sha256((root / rel).read_bytes()).hexdigest() for rel in [
        "scripts/run_b0.py", "scripts/analyze_risk_coverage.py", "src/data/splits.py", "src/matching/topk.py", "src/matching/cosine.py"]})
    metadata["runner_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (args.out / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

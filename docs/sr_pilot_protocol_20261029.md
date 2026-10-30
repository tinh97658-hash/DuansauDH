# SR development spike — frozen choices, 29/10/2026

User authorised a local exploratory pilot after the SR feasibility discussion.
This is a throwaway research spike, not a production feature or a paper claim.
No training, cloud compute, attendance data, test v1/v2 images or test manifest
are used. Existing source and artifacts are not overwritten.

## Question and alternatives

Compare frozen ArcFace FT+flip on the existing 2,000-image development manifest
under (a) current resize, (b) resize-only roundtrip, (c) alignment-only, (d) the
same alignment plus GFPGAN1.4, (e) the same alignment plus CodeFormer w=1.
This controls geometry rather than assuming cropped QMUL chips are aligned.
Retaining the empirical paper without an SR run was the alternative; the user
chose this bounded pilot. No automatic switch of the paper framing is authorised.

## Fixed data and evaluation

- Only `data/processed/qmul_subset_samedomain/manifest_dev.csv`, SHA-256
  `3e89f49aee6bf333db0b825c088fcd4144a3be8ff0674fbba6cb4c5ee427d3c8`.
- All 2,000 images, in manifest order, for gallery, mated, calibration unknown
  and validation unknown. Same pre-existing custom development episodes;
  N=300, seeds 2026–2030; source-role mixing remains a protocol limitation.
- ArcFace pretrained ONNX plus `outputs/qmul_finetune_r50_all_e15/best.pt`,
  state SHA `36e6f2de3389cdb89f5b76ab4fb0b24781d4d4084580ec300da937c669462b9c`.
  Validate native embeddings against the frozen FT+flip cache before interpreting
  any metric. Stop on mismatch; never redefine the baseline to make it fit.
- Model, flip TTA, seeds and identity assignments fixed. Each arm calibrates
  its own score threshold at target FPIR 1% using only its calibration unknowns.
  Report attained validation FPIR; target 1% is not a matched attained risk.
- FNIR is primary. Rank-1, wrong-ID acceptance, FPIR, alignment/fallback rate,
  restoration time and CUDA peak allocated/reserved memory are secondary.
- Paired identity-cluster bootstrap, 2,000 replicates, seed 2026, on pooled
  mated appearances across all five fixed episodes, retaining identity dependence.
  CI is conditional on fixed galleries and fitted thresholds; no correction
  for development selection or multiple arms. No confirmatory claim.

## Fixed preprocessing

Native: cubic resize directly to 112. Roundtrip control: cubic to 512, cubic
back to 112, with no detection. Alignment: existing SCRFD det_10g ONNX on CPU,
input 320x320, detection threshold 0.5; existing min-side 128/max-scale 12
upscale helper. Exactly one detection with finite five-point landmarks required.
Align original pixels to the official FaceRestoreHelper FFHQ 512 template with
LMEDS similarity transform, bilinear warp, constant gray border (135,133,132).
After restoration, use the fixed FFHQ-template-to-ArcFace transform to 112;
do not redetect restored faces. Apply the identical transform to alignment-only.

GFPGAN1.4: official pretrained clean architecture, FP32, deterministic stored
noise (`randomize_noise=False`), no background enhancer or face parsing.
CodeFormer: official pretrained architecture/checkpoint, w=1.0, adain=True,
FP32. No fidelity sweep, retries with tuned values or model fine-tuning.
Inference RGB in [-1,1], official round/clamp conversion to uint8 BGR.

If alignment fails, all aligned/SR arms use the native 112 chip, preserving
every image and the original episode. Restoration runtime failure uses the
alignment-only chip and increments an error count; any such error blocks an
unqualified positive conclusion. Never discard failed/unknown samples.

## Execution and stopping

Actual hardware: RTX3060 Laptop 6GB. Smoke uses 32 evenly spaced manifest
indices, no metrics, for memory/time and finite-output checks. It cannot select
weights or parameters. Full run processes all 2,000 dev images. Load models
sequentially, restoration batch1, ArcFace embedding batch16.
Use official source clones/checkpoints only; record their commit IDs and SHA-256.
Import only inference architecture modules to avoid installing old training
dependency stacks into the existing environment. Record this adapter choice.

Pilot-promote signal (provisional engineering rule, not statistical proof):
FNIR at the independently calibrated operating point improves by at least
3 percentage points versus native, paired FNIR delta CI upper <0, attained
FPIR no more than 0.5 percentage points above native, no restoration errors.
Also require benefit versus alignment-only to attribute a gain to SR.
An attained-risk difference prevents calling the result a matched-risk gain.
Any promising result requires a separate pre-registered confirmation design.

No gate means stop this pilot and retain the empirical-study framing, rather
than launch weight sweeps or touch sealed test data. Public report contains
aggregate metrics and plots only. Private chips/embeddings and run script stay
under ignored `outputs/sr_pilot_dev_20261029/` for local reproduction.

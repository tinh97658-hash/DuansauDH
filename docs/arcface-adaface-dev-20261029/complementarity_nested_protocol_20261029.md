# ArcFace/AdaFace complementarity, score fusion and fixed-probe nested galleries

Declared before new fusion/nested results, 29/10/2026. Exploratory DEVELOPMENT
only, not a confirmatory test; models/previous metrics were already selected
using development. No images, inference, training, Kaggle job or test data.

## Fixed inputs and models

Pinned 2,000-image QMUL dev manifest. Reuse audited embeddings: fine-tuned
ArcFace none/flip and selected epoch-11 AdaFace none/flip. Verify source,
manifest, cache hashes, path/identity order, finite unit vectors, and reproduce
existing per-episode singles before new claims. Seeds 2026–2030, N=100/300/400.

Three predeclared pairs: primary ArcFace-flip + AdaFace-none (AdaFace flip had
no clear N300 benefit and adds compute); secondary none+none and flip+flip.
Fusion is exactly 0.5*cosine_Arc + 0.5*cosine_Ada, formed in float64 from the
two float32 score matrices. No embedding mixing, normalization fit, fitted
weight, grid search, new quality gate or tuning from fusion results.

## Two separate experiment families

1. Frozen old episodes: reproduce the prior custom episodes and thresholds;
   same probes within each episode across methods. Probe pools vary with N,
   so these are not a causal gallery-size experiment. Preserve old argsort
   behavior for exact baseline reproduction. Each method's cutoff is selected
   independently on its calibration unknown scores, strict target FPIR1%.
2. New fixed-probe nested galleries: seed a shuffled pool of all 400
   gallery-capable dev IDs (>=3 images). The first 100 IDs always provide the
   fixed 200 mated probes (2/ID); their true mate is present at every N.
   Sample one gallery photo/ID ONCE at max N=400, choose it before mated probes,
   and subset the same photos for N=100/300/400. Added IDs are distractors only.
   Gallery columns are lexicographically ordered by identity for a stable tie
   rule, independent of N. Source-role mixing of the old custom protocol is
   retained explicitly; this is not an official role-preserving QMUL protocol.

Only the 200 dev IDs with <3 images are eligible unknowns in nested episodes;
none can enter the max gallery. Split these IDs 50:50 by seeded shuffle into
calibration/validation, at most 2 images/ID; the same selected unknown images
and split remain fixed across all N within a seed. Report exact probe counts.
No session/camera mapping is inferred from filename tokens.

Compute score matrices once against the max gallery and slice columns for
each N, avoiding numerical differences for shared comparisons. This permits
per-probe checks: single/fused rank-1 correctness cannot improve merely by
adding distractors; max unknown score and false accepts at a fixed cutoff
cannot decrease. These invariants hold with the declared consistent tie rule.

Nested policies: (a) recalibrate cutoff separately per N/method/seed on the
fixed calibration unknowns, and (b) keep the cutoff calibrated at N=100 for
the same method/seed, then transfer it to N=300/400 without refitting.
N300 is the primary comparison; report all sizes, not just a favorable N.

## Outcomes and uncertainty

Complementarity: both correct, Arc-only, Ada-only, both wrong, wrong-same-ID
and wrong-different-ID; compare the same probe and gallery across methods.
Oracle union is a descriptive ceiling for SELECTING one of two top-1 outputs,
not an implementable model and NOT an upper bound for score fusion: fusion
can recover an identity that is not top-1 in either constituent.

Report rank-1, FNIR, DIR, observed validation FPIR and false-identification
counts, per-N cutoffs/calibration FPIR, and exact decomposition
FNIR = wrong-ranking rate + correctly-ranked-but-rejected rate. Abstentions
count in FNIR. Do not claim matched attained FPIR from equal calibration targets.
Wilson intervals are conditional binomial reference intervals; repeated
unknowns/identity and unknown camera/session dependence limit that interpretation.

Use 1,000 paired identity-cluster bootstrap replicates across repeated seed
appearances for fusion-minus-Arc rank-1 and FNIR; fixed episodes/galleries,
no multiplicity correction. Report seed SD and avoid claims of total
deployment uncertainty. No test evaluation or production replacement.

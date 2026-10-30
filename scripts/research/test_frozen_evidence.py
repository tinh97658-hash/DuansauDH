import itertools
import numpy as np
import pytest

from analyze_frozen_evidence import aurc, decomposition, paired_aurc_bootstrap, wilson


def test_decomposition_disjoint_counts_include_wrong_accepts():
    result = decomposition(np.array([True, True, False, False]), np.array([True, False, True, False]))
    assert result["fnir"] == .75
    assert result["ranking_error_rate"] == .5
    assert result["correct_rank_rejection_rate"] == .25
    assert result["wrong_rank_accepted"] == result["wrong_rank_rejected"] == 1


def test_expected_ties_agree_with_exact_enumeration_and_ignore_input_order():
    correct = np.array([True, False, False])
    exact = np.mean([aurc(correct[list(order)], [0, 0, 0]) for order in itertools.permutations(range(3))])
    assert aurc(correct, [0, 0, 0], tie_average=True) == pytest.approx(exact)
    assert aurc(correct[::-1], [0, 0, 0], tie_average=True) == pytest.approx(exact)
    # A weighted tie must match explicit multiplicity expansion.
    assert aurc(correct, [0, 1, 1], [2, 0, 3], tie_average=True) == pytest.approx(
        aurc(np.repeat(correct, [2, 0, 3]), np.repeat([0, 1, 1], [2, 0, 3]), tie_average=True))


def test_bootstrap_uses_paired_policies_and_preserves_identity_across_seeds():
    episode = {"ids": np.array(["a", "a", "b", "b"]), "correct": np.array([True, True, False, False]),
               "gap": np.array([0, 1, 2, 3]), "score": np.array([0, 1, 2, 3]), "min_side": np.array([3, 2, 1, 0])}
    one = paired_aurc_bootstrap([episode], replicates=100)
    repeated = paired_aurc_bootstrap([episode, episode], replicates=100)
    assert one[0]["difference"] == one[0]["ci_low"] == one[0]["ci_high"] == 0
    for a, b in zip(one, repeated):
        assert a["ci_low"] == b["ci_low"] and a["ci_high"] == b["ci_high"]


def test_zero_false_positives_does_not_produce_zero_width_interval():
    low, high = wilson(0, 300)
    assert low == pytest.approx(0, abs=1e-16)
    assert .012 < high < .013
    with pytest.raises(ValueError):
        aurc([True], [0], [0])

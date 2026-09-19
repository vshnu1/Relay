"""The synthetic priors: one per program, trained on levels that cover its core.

These hold in place the claim that every program scores a short-history
patient instead of refusing, and the two failure modes that would make a
prior worse than none: a prior fitted on empty columns, and a prior that
throws at transform time under a different scikit-learn release.
"""

import dataclasses
import unittest

import numpy as np

from relay_ml.model import ModelResult, _score_with_prior, load_prior
from relay_ml.programs import PROGRAMS
from relay_ml.score import score_request
from relay_ml.synthetic import (
    CADENCE,
    CLINICAL_LEVELS,
    GAIT_LEVELS,
    POSTOP_LEVELS,
    SOURCE_OF,
    synthetic_patient,
)
from relay_ml.train import levels_for

ANCHOR = 1789732800000


class LevelsTest(unittest.TestCase):
    def test_every_program_has_levels_covering_its_core(self):
        for key, program in PROGRAMS.items():
            levels = levels_for(program)
            self.assertTrue(set(program.core) <= set(levels), key)

    def test_a_program_whose_core_is_not_covered_is_refused(self):
        # Training against levels that lack a core metric would fit a confident
        # model on empty columns. The trainer must refuse rather than do that.
        bogus = dataclasses.replace(PROGRAMS["copd_recovery"], key="bogus", core=("no_such_metric",))
        with self.assertRaises(ValueError):
            levels_for(bogus)

    def test_generator_knows_every_metric_it_is_asked_to_produce(self):
        for levels in (POSTOP_LEVELS, GAIT_LEVELS, CLINICAL_LEVELS):
            for metric in levels:
                self.assertIn(metric, CADENCE, metric)
                self.assertIn(metric, SOURCE_OF, metric)


class ArtifactTest(unittest.TestCase):
    def test_every_program_loads_a_prior_for_itself(self):
        for key, program in PROGRAMS.items():
            prior = load_prior(key)
            self.assertIsNotNone(prior, f"{key} has no usable prior artifact")
            _, meta = prior
            self.assertEqual(meta["program"], key)
            self.assertEqual(meta["training_data"], "synthetic")
            if "core_metrics" in meta:
                self.assertEqual(tuple(meta["core_metrics"]), tuple(program.core), key)

    def test_a_patient_with_days_of_history_is_scored_by_the_prior_not_refused(self):
        for key, program in PROGRAMS.items():
            events = synthetic_patient(levels_for(program), 6, ANCHOR, seed=3)
            result = score_request({"events": events, "context": None, "program": key}, seed=0)
            self.assertEqual(result["model"]["status"], "prior", key)
            self.assertEqual(result["model"]["training_data"], "synthetic", key)
            # Days of history are never enough to recommend a review on their own.
            self.assertNotEqual(result["application_state"], "review_recommended", key)


class _BrokenPipe:
    """Stands in for a pipeline pickled under another scikit-learn release."""

    def decision_function(self, X):
        raise AttributeError("'SimpleImputer' object has no attribute '_fill_dtype'")


class PriorFallbackTest(unittest.TestCase):
    def test_a_prior_that_cannot_transform_yields_unavailable_not_an_exception(self):
        meta = {"feature_dim_in": 4, "threshold_raw": 0.03, "score_scale_raw": 0.05, "artifact": "x.joblib"}
        diag = {}
        result = _score_with_prior((_BrokenPipe(), meta), np.zeros((3, 4)), diag)
        self.assertIsInstance(result, ModelResult)
        self.assertEqual(result.status, "unavailable")
        self.assertIn("scikit-learn", diag["reason"])
        self.assertIn("AttributeError", diag["reason"])

    def test_a_prior_of_the_wrong_width_is_declined_before_it_is_asked_anything(self):
        meta = {"feature_dim_in": 9, "threshold_raw": 0.03, "score_scale_raw": 0.05}
        diag = {}
        result = _score_with_prior((_BrokenPipe(), meta), np.zeros((3, 4)), diag)
        self.assertEqual(result.status, "unavailable")
        self.assertIn("dimension", diag["reason"])


if __name__ == "__main__":
    unittest.main()

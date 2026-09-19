import unittest

import numpy as np

from relay_ml.model import calibrate, chronological_split, fit_and_score, make_pipeline, terminal_run, to_scores, usable_rows


class SplitTest(unittest.TestCase):
    def test_chronological_and_disjoint(self):
        tr, va, te = chronological_split(57)
        self.assertEqual((len(tr), len(va), len(te)), (34, 11, 12))
        self.assertLess(tr.max(), va.min())
        self.assertLess(va.max(), te.min())

    def test_small_n(self):
        tr, va, te = chronological_split(16)
        self.assertEqual(len(tr) + len(va) + len(te), 16)
        self.assertGreaterEqual(len(va), 1)


class ScoringTest(unittest.TestCase):
    def test_terminal_run(self):
        self.assertEqual(terminal_run([0, 1, 1, 1]), (3, 1))
        self.assertEqual(terminal_run([1, 1, 0]), (0, None))
        self.assertEqual(terminal_run([]), (0, None))

    def test_scores_centre_on_threshold(self):
        thr, scale = calibrate(np.linspace(0, 1, 20), np.linspace(0, 1, 20), 0.95)
        self.assertAlmostEqual(float(to_scores([thr], thr, scale)[0]), 0.5)
        self.assertGreater(float(to_scores([thr + 5 * scale], thr, scale)[0]), 0.99)

    def test_pipeline_handles_missing_and_flags_shifted_rows(self):
        rng = np.random.default_rng(0)
        X_hist = rng.normal(0, 1, size=(60, 4))
        X_hist[::7, 1] = np.nan
        X_hist = np.column_stack([X_hist, np.ones(60), np.full(60, 4.0)])
        X_recent = np.column_stack([np.full((5, 4), 4.0), np.ones(5), np.full(5, 4.0)])
        res = fit_and_score(X_hist, X_recent, 4, quantile=0.95, seed=0)
        self.assertEqual(res.status, "fitted")
        self.assertTrue(np.all(res.flags_recent))
        self.assertGreater(res.scores_recent[-1], 0.75)
        self.assertEqual(res.diagnostics["n_train"], 36)
        # indicator columns were added for the column with missing values
        self.assertGreater(res.diagnostics["feature_dim_model"], 6)

    def test_ordinary_rows_are_mostly_not_flagged(self):
        rng = np.random.default_rng(1)
        X_hist = np.column_stack([rng.normal(0, 1, size=(80, 3)), np.ones(80), np.full(80, 3.0)])
        X_recent = np.column_stack([rng.normal(0, 1, size=(40, 3)), np.ones(40), np.full(40, 3.0)])
        res = fit_and_score(X_hist, X_recent, 3, quantile=0.95, seed=0)
        self.assertLess(res.flags_recent.mean(), 0.35)

    def test_insufficient_history_without_prior_is_unavailable(self):
        X = np.column_stack([np.zeros((5, 2)), np.ones(5), np.full(5, 2.0)])
        res = fit_and_score(X, X[:1], 2, prior=None)
        self.assertEqual(res.status, "unavailable")

    def test_usable_rows(self):
        X = np.array([[np.nan, np.nan, 1.0], [1.0, np.nan, 1.0]])
        self.assertEqual(usable_rows(X, 2).tolist(), [False, True])
        self.assertEqual(usable_rows(X, [1]).tolist(), [False, False])  # core column entirely missing
        self.assertEqual(usable_rows(X, [2]).tolist(), [True, True])

    def test_pipeline_is_deterministic(self):
        X = np.random.default_rng(2).normal(size=(40, 3))
        a = make_pipeline(0).fit(X).decision_function(X)
        b = make_pipeline(0).fit(X).decision_function(X)
        self.assertTrue(np.allclose(a, b))


if __name__ == "__main__":
    unittest.main()

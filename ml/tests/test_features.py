import unittest

import numpy as np

from vesper_ml.baseline import rolling_baseline
from vesper_ml.contracts import normalize
from vesper_ml.features import build_features
from vesper_ml.programs import get_program
from vesper_ml.synthetic import simulate
from vesper_ml.windows import build_grid

ANCHOR = 1789732800000
PROGRAM = get_program("post_abdominal_surgery")


def daily_events(days, metric="rhr", unit="bpm", value=60.0, start_ms=ANCHOR - 30 * 86_400_000):
    from vesper_ml.contracts import from_epoch_ms, to_iso

    return [
        {"metric": metric, "value": value + (i % 3) * 0.5, "unit": unit, "timestamp": to_iso(from_epoch_ms(start_ms + i * 86_400_000)), "source": "wearable"}
        for i in range(days)
    ]


class GridTest(unittest.TestCase):
    def test_engine_scenario_grid(self):
        grid = build_grid(normalize(simulate("ambiguous", ANCHOR)))
        self.assertEqual(grid.cadence_hours, 6.0)
        self.assertEqual(grid.window_hours, 36.0)
        self.assertEqual(len(grid.ends_ms), 63)
        self.assertEqual(int(grid.recent_mask().sum()), 7)  # engine includes the sample at the cutoff
        rhr = grid.series["rhr"]
        self.assertTrue(np.all(rhr.fresh))
        self.assertTrue(np.allclose(rhr.observed, rhr.filled, equal_nan=True))

    def test_daily_cadence_fills_windows_but_marks_staleness(self):
        grid = build_grid(normalize(daily_events(30)))
        s = grid.series["rhr"]
        self.assertEqual(s.cadence_hours, 24.0)
        self.assertEqual(s.lookback_hours, 48.0)
        self.assertEqual(grid.window_hours, 72.0)
        # three of every four windows have no direct observation, yet every window is fresh
        self.assertLess(np.count_nonzero(~np.isnan(s.observed)), len(s.observed) / 2)
        self.assertTrue(np.all(s.fresh))

    def test_missing_recent_data_is_stale_not_normal(self):
        events = daily_events(30)
        events = events[:-4]  # sensor stops four days early
        grid = build_grid(normalize(events), analyzed_through_ms=ANCHOR - 86_400_000)
        s = grid.series["rhr"]
        self.assertFalse(s.fresh[-1])
        self.assertTrue(np.isnan(s.filled[-1]))


class BaselineTest(unittest.TestCase):
    def test_engine_scenario_baselines_are_sufficient_and_deviation_is_large(self):
        grid = build_grid(normalize(simulate("ambiguous", ANCHOR)))
        fs = build_features(grid, PROGRAM)
        track = fs.tracks["rhr"]
        self.assertTrue(track.sufficient[-1])
        self.assertAlmostEqual(track.median[-1], 64.0, delta=1.2)
        self.assertGreater(fs.deviations["rhr"][-1], 3.0)
        self.assertLess(fs.deviations["hrv"][-1], -3.0)
        self.assertGreater(fs.percents["rhr"][-1], 10.0)
        # early windows have no baseline yet: missing, not zero
        self.assertTrue(np.isnan(fs.deviations["rhr"][0]))

    def test_explained_scenario_stays_within_threshold_at_latest_window(self):
        grid = build_grid(normalize(simulate("explained", ANCHOR)))
        fs = build_features(grid, PROGRAM)
        for m in ("rhr", "hrv", "respiratory", "sleep", "spo2"):
            self.assertLess(abs(fs.deviations[m][-1]), PROGRAM.deviation_threshold)

    def test_new_device_has_no_baseline_until_history_exists(self):
        events = normalize(simulate("ambiguous", ANCHOR) + daily_events(2, metric="steps", unit="count", value=5000, start_ms=ANCHOR - 86_400_000))
        grid = build_grid(events)
        fs = build_features(grid, PROGRAM)
        self.assertTrue(np.all(np.isnan(fs.deviations["steps"])))
        self.assertIn("dev:steps", fs.columns)

    def test_daily_cadence_meets_sufficiency(self):
        grid = build_grid(normalize(daily_events(30)))
        track = rolling_baseline(grid.series["rhr"], grid, PROGRAM)
        self.assertTrue(track.sufficient[-1])
        self.assertGreaterEqual(track.count[-1], PROGRAM.min_baseline_points)

    def test_feature_matrix_shape(self):
        grid = build_grid(normalize(simulate("ambiguous", ANCHOR)))
        fs = build_features(grid, PROGRAM)
        self.assertEqual(fs.X.shape, (63, len(PROGRAM.metrics) + 4))
        self.assertEqual(fs.coverage[-1], 1.0)


if __name__ == "__main__":
    unittest.main()

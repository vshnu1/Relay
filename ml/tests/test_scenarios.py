"""Every committed fixture must be synthetic, must not leak device names, and
must reproduce its recorded outcome when scored again."""

import json
import os
import unittest

from relay_ml.fixtures import FIXTURE_DIR, load_fixture
from relay_ml.score import score_request
from relay_ml.synthetic import SCENARIOS

EXPECTED_STATES = {
    "ambiguous": ("context_needed", None),
    "explained": ("monitoring", "monitoring"),
    "review": ("context_needed", "review_recommended"),
    "postoperative_drift": ("context_needed", "review_recommended"),
    "missing_sensor": ("insufficient_data", None),
    "gait_decline": ("context_needed", "review_recommended"),
}


class FixtureTest(unittest.TestCase):
    def test_all_scenarios_have_fixtures(self):
        with open(os.path.join(FIXTURE_DIR, "expected.json")) as fh:
            index = json.load(fh)
        self.assertEqual(set(index), set(SCENARIOS))

    def test_fixtures_reproduce_expected_states(self):
        for name, (without, with_ctx) in EXPECTED_STATES.items():
            fx = load_fixture(name)
            self.assertTrue(fx["synthetic"])
            r = score_request(fx["request"], seed=0)
            self.assertEqual(r["application_state"], without, name)
            self.assertEqual(r["application_state"], fx["expected"]["without_context"]["application_state"], name)
            self.assertEqual(sorted(s["metric"] for s in r["signals"] if s["flagged"]), fx["expected"]["without_context"]["flagged"], name)
            if with_ctx:
                r2 = score_request({**fx["request"], "context": fx["context"]}, seed=0)
                self.assertEqual(r2["application_state"], with_ctx, name)

    def test_fixture_sources_are_generic(self):
        for name in SCENARIOS:
            fx = load_fixture(name)
            sources = {e["source"] for e in fx["request"]["events"]}
            for src in sources:
                self.assertTrue(src.startswith("Simulated ") or src in ("wearable", "phone", "manual", "unknown"), (name, src))

    def test_missing_sensor_lists_stale_core_signals(self):
        fx = load_fixture("missing_sensor")
        r = score_request(fx["request"], seed=0)
        stale = {m["metric"] for m in r["missing_signals"] if m["reason"] == "stale"}
        self.assertTrue({"rhr", "hrv", "respiratory", "spo2", "sleep"} <= stale)
        self.assertEqual(r["state"], "context")
        self.assertEqual(r["data_quality"]["status"], "insufficient")
        self.assertFalse(r["is_anomalous"])

    def test_drift_contributors_are_traceable(self):
        fx = load_fixture("postoperative_drift")
        r = score_request(fx["request"], seed=0)
        self.assertTrue(r["is_anomalous"])
        self.assertIsNotNone(r["change_point"])
        for c in r["contributors"]:
            self.assertIn(c["direction"], ("above_baseline", "below_baseline"))
            self.assertTrue(c["supporting_ids"], c["metric"])
            self.assertTrue(all(i.startswith(f"obs-{c['metric']}-") for i in c["supporting_ids"]))
        top = {c["metric"] for c in r["contributors"][:3]}
        self.assertTrue(top & {"rhr", "hrv", "respiratory", "sleep", "spo2", "heart_rate"})

    def test_gait_program_never_claims_stroke_detection(self):
        fx = load_fixture("gait_decline")
        r = score_request({**fx["request"], "context": fx["context"]}, seed=0)
        self.assertEqual(r["program"], "stroke_rehabilitation")
        self.assertNotIn("stroke", r["summary"].lower())
        self.assertEqual(r["application_state"], "review_recommended")


if __name__ == "__main__":
    unittest.main()

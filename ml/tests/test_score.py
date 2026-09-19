import json
import os
import subprocess
import sys
import unittest

from relay_ml.contracts import APPLICATION_STATES
from relay_ml.score import score_request
from relay_ml.synthetic import ENGINE_CONTEXT, simulate

ANCHOR = 1789732800000
ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORBIDDEN = ("healthy", "safe", "emergency", "sepsis", "infection", "deterioration", "diagnos", "stroke detected", "complication")

LEGACY_KEYS = ("state", "summary", "coordinated", "windowHours", "analyzedThrough", "rule", "context", "signals", "cadenceHours", "overlapHours")
NEW_KEYS = ("application_state", "anomaly_score", "is_anomalous", "contributors", "missing_signals", "data_quality", "model_version")


def run(scenario, context=None, **extra):
    req = {"events": simulate(scenario, ANCHOR), "context": context, "program": "post_abdominal_surgery", **extra}
    return score_request(req, seed=0)


class EngineScenarioTest(unittest.TestCase):
    def test_ambiguous_requests_context(self):
        r = run("ambiguous")
        self.assertEqual(r["application_state"], "context_needed")
        self.assertEqual(r["state"], "context")
        self.assertTrue(r["coordinated"])
        self.assertTrue(r["rule_coordinated"])
        flagged = [s["metric"] for s in r["signals"] if s["flagged"]]
        self.assertEqual(set(flagged), {"rhr", "hrv", "respiratory", "sleep", "glucose"})
        rhr = next(s for s in r["signals"] if s["metric"] == "rhr")
        self.assertEqual(rhr["duration"], 36.0)
        self.assertEqual(len(rhr["sourceIds"]), 7)
        self.assertTrue(all(i.startswith("obs-rhr-") for i in rhr["sourceIds"]))
        self.assertGreater(rhr["delta"], 10)
        self.assertIn("Patient context is missing", r["summary"])
        self.assertEqual(r["model"]["status"], "fitted")
        self.assertTrue(r["is_anomalous"])
        self.assertGreater(r["anomaly_score"], 0.5)

    def test_explained_stays_quiet(self):
        r = run("explained", ENGINE_CONTEXT["explained"])
        self.assertEqual(r["application_state"], "monitoring")
        self.assertEqual(r["state"], "quiet")
        self.assertFalse(r["coordinated"])
        self.assertFalse(any(s["flagged"] for s in r["signals"]))
        self.assertFalse(r["is_anomalous"])

    def test_review_needs_context(self):
        before = run("review")
        after = run("review", ENGINE_CONTEXT["review"])
        self.assertEqual(before["application_state"], "context_needed")
        self.assertEqual(after["application_state"], "review_recommended")
        self.assertEqual(after["state"], "review")
        self.assertEqual([s["flagged"] for s in before["signals"]], [s["flagged"] for s in after["signals"]])
        self.assertIn("fatigue — Worsening", after["summary"])

    def test_model_alone_never_yields_review(self):
        for scenario in ("ambiguous", "explained", "review"):
            r = run(scenario, None)
            self.assertNotEqual(r["application_state"], "review_recommended")

    def test_output_contract_and_language(self):
        r = run("ambiguous")
        for k in LEGACY_KEYS + NEW_KEYS:
            self.assertIn(k, r)
        self.assertIn(r["application_state"], APPLICATION_STATES)
        self.assertEqual(r["model_version"], "baseline-iforest-v1")
        json.dumps(r)  # JSON-safe
        text = (r["summary"] + " " + r["rule"]).lower()
        for word in FORBIDDEN:
            self.assertNotIn(word, text)
        for s in r["signals"]:
            self.assertIn(s["quality"], ("Available", "Missing recent data", "Insufficient baseline"))
            for e in s["recent"]:
                self.assertEqual(set(e), {"id", "metric", "timestamp", "value", "unit", "source"})

    def test_analyzed_through_truncates(self):
        r = run("ambiguous", analyzedThrough="2026-09-16T12:00:00Z")
        self.assertEqual(r["analyzedThrough"], "2026-09-16T12:00:00.000Z")
        self.assertEqual(r["application_state"], "monitoring")

    def test_protocol_rule_applies_outside_model(self):
        r = run("explained", {"exercise": "Recent exercise", "fatigue": "None", "medication": "No changes", "shortness_of_breath": True, "consent": True})
        self.assertEqual(r["application_state"], "review_recommended")
        self.assertIn("Illustrative protocol rule", r["summary"])

    def test_stroke_program_runs_on_gait_metrics_absent(self):
        r = run("ambiguous", program="stroke_rehabilitation")
        self.assertEqual(r["application_state"], "insufficient_data")
        self.assertEqual(r["state"], "context")
        self.assertEqual(r["data_quality"]["status"], "insufficient")
        self.assertTrue(all(m["reason"] == "no_data" for m in r["missing_signals"]))


class CliTest(unittest.TestCase):
    def test_score_roundtrip_via_stdin(self):
        req = json.dumps({"events": simulate("ambiguous", ANCHOR), "context": None, "program": "post_abdominal_surgery", "analyzedThrough": "2026-09-18T12:00:00Z"})
        env = {**os.environ, "PYTHONPATH": ML_DIR}
        proc = subprocess.run([sys.executable, "-m", "relay_ml", "score", "--compact"], input=req, capture_output=True, text=True, env=env, cwd=ML_DIR)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = json.loads(proc.stdout)
        self.assertEqual(out["state"], "context")
        self.assertIn("signals", out)


if __name__ == "__main__":
    unittest.main()


class PriorModelTest(unittest.TestCase):
    def test_short_history_uses_synthetic_prior_and_never_reviews(self):
        from relay_ml.synthetic import POSTOP_LEVELS, synthetic_patient

        events = synthetic_patient(POSTOP_LEVELS, 6, ANCHOR, seed=3)
        r = score_request({"events": events, "context": None, "program": "post_abdominal_surgery"}, seed=0)
        self.assertIn(r["model"]["status"], ("prior", "unavailable"))
        self.assertNotEqual(r["application_state"], "review_recommended")
        if r["model"]["status"] == "prior":
            self.assertEqual(r["model"]["training_data"], "synthetic")
            self.assertIn("synthetic", r["rule"].lower())


class SensorDropoutTest(unittest.TestCase):
    """Sensors stopping is a data-quality fact, not a physiological anomaly.

    Regression for the LifeSnaps cohort case where four of five core sensors
    went stale for a week with no deviation above one robust unit, and the
    missingness indicators alone pushed the window over the threshold."""

    def test_partial_dropout_without_deviation_is_not_context_needed(self):
        from relay_ml.synthetic import POSTOP_LEVELS, synthetic_patient

        for seed in range(4):
            events = synthetic_patient(
                POSTOP_LEVELS, 35, ANCHOR, seed=seed, dropout={"hrv", "respiratory", "spo2", "heart_rate"}, dropout_days=7
            )
            r = score_request({"events": events, "context": None, "program": "post_abdominal_surgery"}, seed=0)
            self.assertNotEqual(r["application_state"], "context_needed", seed)
            self.assertFalse(r["is_anomalous"], seed)
            self.assertEqual(r["data_quality"]["status"], "partial", seed)
            stale = {m["metric"] for m in r["missing_signals"] if m["reason"] == "stale"}
            self.assertTrue({"hrv", "respiratory", "spo2"} <= stale, seed)

    def test_neutralization_diagnostics_are_reported(self):
        from relay_ml.synthetic import POSTOP_LEVELS, synthetic_patient

        events = synthetic_patient(POSTOP_LEVELS, 35, ANCHOR, seed=0, dropout={"hrv", "respiratory", "spo2", "heart_rate"}, dropout_days=7)
        r = score_request({"events": events, "context": None, "program": "post_abdominal_surgery"}, seed=0)
        self.assertIn("missingness_neutralized_windows", r["model"])
        self.assertGreater(r["model"]["missingness_neutralized_windows"], 0)
        self.assertLessEqual(r["model"]["latest_raw_net_of_missingness"], r["model"]["latest_raw_with_missingness"])

    def test_real_deviation_still_detected_when_a_sensor_stops(self):
        """Same patient as the committed drift fixture, with one sensor's last two
        days removed after generation: the deviation on the remaining sensors
        must still be enough. Missingness may amplify, never originate."""
        from relay_ml.fixtures import load_fixture

        fx = load_fixture("postoperative_drift")
        req = fx["request"]
        cut = "2026-09-16T12:00:00.000Z"
        for dropped in ({"spo2"}, {"spo2", "respiratory"}):
            events = [e for e in req["events"] if not (e["metric"] in dropped and e["timestamp"] >= cut)]
            r = score_request({**req, "events": events}, seed=0)
            self.assertEqual(r["application_state"], "context_needed", dropped)
            self.assertTrue(r["is_anomalous"], dropped)
            self.assertTrue({"rhr", "hrv"} <= {c["metric"] for c in r["contributors"]}, dropped)

import json
import os
import subprocess
import sys
import unittest

from vesper_ml.contracts import APPLICATION_STATES
from vesper_ml.score import score_request
from vesper_ml.synthetic import ENGINE_CONTEXT, simulate

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
        proc = subprocess.run([sys.executable, "-m", "vesper_ml", "score", "--compact"], input=req, capture_output=True, text=True, env=env, cwd=ML_DIR)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = json.loads(proc.stdout)
        self.assertEqual(out["state"], "context")
        self.assertIn("signals", out)


if __name__ == "__main__":
    unittest.main()


class PriorModelTest(unittest.TestCase):
    def test_short_history_uses_synthetic_prior_and_never_reviews(self):
        from vesper_ml.synthetic import POSTOP_LEVELS, synthetic_patient

        events = synthetic_patient(POSTOP_LEVELS, 6, ANCHOR, seed=3)
        r = score_request({"events": events, "context": None, "program": "post_abdominal_surgery"}, seed=0)
        self.assertIn(r["model"]["status"], ("prior", "unavailable"))
        self.assertNotEqual(r["application_state"], "review_recommended")
        if r["model"]["status"] == "prior":
            self.assertEqual(r["model"]["training_data"], "synthetic")
            self.assertIn("synthetic", r["rule"].lower())

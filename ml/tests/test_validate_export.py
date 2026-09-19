import io
import json
import os
import tempfile
import unittest
from unittest import mock

from vesper_ml import validate_export
from vesper_ml.synthetic import POSTOP_LEVELS, synthetic_patient

ANCHOR = 1789732800000


def synthetic_xml(days=30):
    """A tiny Apple-Health-shaped export built from synthetic events only."""
    from datetime import datetime, timezone

    events = synthetic_patient({k: POSTOP_LEVELS[k] for k in ("rhr", "hrv", "spo2", "respiratory")}, days, ANCHOR, seed=5)
    hk = {"rhr": ("RestingHeartRate", "count/min", 1), "hrv": ("HeartRateVariabilitySDNN", "ms", 1), "spo2": ("OxygenSaturation", "%", 0.01), "respiratory": ("RespiratoryRate", "count/min", 1)}
    rows = []
    for e in events:
        t, unit, mult = hk[e["metric"]]
        dt = datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S +0000")
        rows.append(f'<Record type="HKQuantityTypeIdentifier{t}" sourceName="Fixture Strap" unit="{unit}" value="{e["value"] * mult}" startDate="{dt}" endDate="{dt}"/>')
    return ("<HealthData>" + "".join(rows) + "</HealthData>").encode()


class ValidateExportTest(unittest.TestCase):
    def test_report_is_aggregate_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            xml_path = os.path.join(tmp, "export.xml")
            with open(xml_path, "wb") as fh:
                fh.write(synthetic_xml())
            report = os.path.join(tmp, "report.json")
            with mock.patch.dict(os.environ, {"HEALTH_EXPORT_XML": xml_path}), mock.patch("sys.stdout", new_callable=io.StringIO):
                code = validate_export.run(program="post_abdominal_surgery", report=report, backtest_days=3)
            self.assertEqual(code, 0)
            with open(report) as fh:
                out = json.load(fh)
        blob = json.dumps(out)
        self.assertNotIn("Fixture Strap", blob)
        self.assertNotIn(xml_path, blob)
        self.assertNotIn('"events"', blob)
        self.assertNotIn('"timestamp"', blob)
        self.assertIn("post_abdominal_surgery", out["programs"])
        prog = out["programs"]["post_abdominal_surgery"]
        self.assertEqual(prog["backtest"]["analysis_points"], 4)
        self.assertIn("application_states", prog["backtest"])
        self.assertIn("read_seconds", out["export"])
        self.assertEqual(out["export"]["source_categories"], {"wearable": 4})  # counted per metric
        self.assertRegex(prog["latest"]["analyzed_through_month"], r"^\d{4}-\d{2}$")

    def test_missing_export_is_reported_not_guessed(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HEALTH_EXPORT_XML", None)
            with self.assertRaises(FileNotFoundError):
                validate_export.run(export_path=None)


if __name__ == "__main__":
    unittest.main()

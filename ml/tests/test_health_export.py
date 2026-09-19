import io
import os
import unittest

from relay_ml.health_export import read_export, resolve_path, source_category

XML = b"""<HealthData>
<Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Test Watch" unit="%" value="0.98" startDate="2026-09-18 12:10:00 -0400" endDate="2026-09-18 12:10:00 -0400"/>
<Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Test Watch" unit="%" value="0.96" startDate="2026-09-18 13:00:00 -0400" endDate="2026-09-18 13:00:00 -0400"/>
<Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Other Device" unit="%" value="0.50" startDate="2026-09-18 13:00:00 -0400" endDate="2026-09-18 13:00:00 -0400"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test iPhone" unit="count" value="120" startDate="2026-09-18 12:00:00 -0400" endDate="2026-09-18 12:05:00 -0400"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Test iPhone" unit="count" value="80" startDate="2026-09-18 14:00:00 -0400" endDate="2026-09-18 14:05:00 -0400"/>
<Record type="HKQuantityTypeIdentifierWalkingSpeed" sourceName="Test iPhone" unit="km/hr" value="3.6" startDate="2026-09-18 12:00:00 -0400" endDate="2026-09-18 12:05:00 -0400"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Test Watch" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-09-18 01:00:00 -0400" endDate="2026-09-18 03:00:00 -0400"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Test Watch" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-09-18 00:30:00 -0400" endDate="2026-09-18 03:30:00 -0400"/>
<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Test Watch" unit="count/min" value="70" startDate="2026-09-18 12:00:00 -0400" endDate="2026-09-18 12:00:00 -0400">
  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="1"/>
</Record>
<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="kg" value="70" startDate="2026-09-18 12:00:00 -0400" endDate="2026-09-18 12:00:00 -0400">
  <MetadataEntry key="HKWasUserEntered" value="1"/>
</Record>
</HealthData>"""


class ReadExportTest(unittest.TestCase):
    def setUp(self):
        self.events, self.summary = read_export(io.BytesIO(XML))
        self.by_metric = {}
        for e in self.events:
            self.by_metric.setdefault(e["metric"], []).append(e)

    def test_source_names_never_appear(self):
        blob = repr(self.events) + repr(self.summary)
        for name in ("Test Watch", "Other Device", "Test iPhone", "Health"):
            self.assertNotIn(name, blob)
        self.assertEqual({e["source"] for e in self.by_metric["spo2"]}, {"wearable"})
        self.assertEqual({e["source"] for e in self.by_metric["steps"]}, {"phone"})
        self.assertEqual({e["source"] for e in self.by_metric["weight"]}, {"manual"})

    def test_single_source_selected_and_spo2_rescaled(self):
        spo2 = self.by_metric["spo2"]
        self.assertEqual(len(spo2), 1)  # both Test Watch readings fall in the same 6h UTC window
        self.assertAlmostEqual(spo2[0]["value"], 97.0)
        self.assertEqual(self.summary["alternate_sources_dropped_by_metric"]["spo2"], 1)

    def test_sums_and_unit_conversion(self):
        self.assertEqual(sum(e["value"] for e in self.by_metric["steps"]), 200)
        self.assertAlmostEqual(self.by_metric["walking_speed"][0]["value"], 1.0)
        self.assertAlmostEqual(self.by_metric["sleep"][0]["value"], 2.0)  # InBed excluded

    def test_window_timestamps_are_six_hour_aligned(self):
        for e in self.events:
            self.assertIn(e["timestamp"][11:], ("00:00:00.000Z", "06:00:00.000Z", "12:00:00.000Z", "18:00:00.000Z"))

    def test_summary_is_aggregate_only(self):
        self.assertEqual(self.summary["records_scanned"], 10)
        self.assertEqual(self.summary["source_categories"], {"manual": 1, "phone": 2, "wearable": 3})
        self.assertNotIn("events", self.summary)
        self.assertIn("parse_seconds", self.summary)


class PathTest(unittest.TestCase):
    def test_requires_env_or_argument(self):
        old = os.environ.pop("HEALTH_EXPORT_XML", None)
        try:
            with self.assertRaises(FileNotFoundError):
                resolve_path()
        finally:
            if old is not None:
                os.environ["HEALTH_EXPORT_XML"] = old

    def test_category_mapping(self):
        self.assertEqual(source_category("Some Strap"), "wearable")
        self.assertEqual(source_category("My iPhone"), "phone")
        self.assertEqual(source_category("Mystery"), "unknown")
        self.assertEqual(source_category("Mystery", user_entered=True), "manual")


if __name__ == "__main__":
    unittest.main()

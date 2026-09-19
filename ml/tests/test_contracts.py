import unittest

from relay_ml.contracts import ContractError, normalize, normalize_context, parse_timestamp, to_iso


def event(**over):
    e = {"metric": "rhr", "value": 64, "unit": "bpm", "timestamp": "2026-09-18T12:00:00Z", "source": "Simulated wearable"}
    e.update(over)
    return e


class NormalizeTest(unittest.TestCase):
    def test_accepts_existing_contract_and_emits_engine_ids(self):
        out = normalize([event()])
        self.assertEqual(out[0]["id"], "obs-rhr-1789732800000")
        self.assertEqual(out[0]["timestamp"], "2026-09-18T12:00:00.000Z")
        self.assertEqual(out[0]["value"], 64.0)

    def test_sorts_chronologically(self):
        out = normalize([event(timestamp="2026-09-18T18:00:00Z"), event(timestamp="2026-09-18T12:00:00Z")])
        self.assertLess(out[0]["_ms"], out[1]["_ms"])

    def test_rejects_unit_duplicates_and_naive_timestamps(self):
        with self.assertRaisesRegex(ContractError, "expected unit"):
            normalize([event(unit="other")])
        with self.assertRaisesRegex(ContractError, "duplicate"):
            normalize([event(), event()])
        with self.assertRaisesRegex(ContractError, "timezone"):
            normalize([event(timestamp="2026-09-18")])
        with self.assertRaisesRegex(ContractError, "invalid"):
            normalize([event(value=float("nan"))])
        with self.assertRaisesRegex(ContractError, "invalid"):
            normalize([event(value=True)])
        with self.assertRaisesRegex(ContractError, "unsupported metric"):
            normalize([event(metric="bogus")])

    def test_internal_metrics_are_accepted_with_their_own_bounds(self):
        out = normalize([event(metric="steps", unit="count", value=12000)])
        self.assertEqual(out[0]["metric"], "steps")
        with self.assertRaises(ContractError):
            normalize([event(metric="walking_speed", unit="m/s", value=50)])

    def test_offset_timestamps_convert_to_utc(self):
        dt = parse_timestamp("2026-09-18T08:00:00-04:00")
        self.assertEqual(to_iso(dt), "2026-09-18T12:00:00.000Z")


class ContextTest(unittest.TestCase):
    def test_drops_free_text_and_nested_values(self):
        ctx = normalize_context({"exercise": "No unusual activity", "notes": "x" * 200, "nested": {"a": 1}, "falls": True})
        self.assertEqual(ctx, {"exercise": "No unusual activity", "falls": True})

    def test_empty_context_is_none(self):
        self.assertIsNone(normalize_context({}))
        self.assertIsNone(normalize_context(None))


if __name__ == "__main__":
    unittest.main()

import unittest

from relay_ml.contracts import normalize
from relay_ml.synthetic import ENGINE_SHIFTS, simulate

ANCHOR = 1789732800000  # 2026-09-18T12:00:00Z


class EngineParityTest(unittest.TestCase):
    def test_shape_matches_engine(self):
        events = simulate("ambiguous", ANCHOR)
        self.assertEqual(len(events), 63 * 6)
        out = normalize(events)
        self.assertEqual(out[-1]["timestamp"], "2026-09-18T12:00:00.000Z")
        self.assertEqual(out[0]["timestamp"], "2026-09-03T00:00:00.000Z")

    def test_known_engine_values(self):
        # First record: rhr at i=0, idx=0 -> 64 * (1 + sin(0) * 0.017) = 64.0
        first = simulate("ambiguous", ANCHOR)[0]
        self.assertEqual((first["metric"], first["value"]), ("rhr", 64.0))
        # Last record: spo2 at i=62, idx=5 -> shift 0 -> 98 * (1 + sin(62*1.7+5)*0.017)
        last = simulate("ambiguous", ANCHOR)[-1]
        self.assertEqual((last["metric"], last["value"]), ("spo2", 97.3))
        # Shifted rhr in the recent window is well above base.
        recent_rhr = [e["value"] for e in simulate("ambiguous", ANCHOR) if e["metric"] == "rhr"][56:]
        self.assertTrue(all(v > 64 * (1 + ENGINE_SHIFTS["rhr"] - 0.02) for v in recent_rhr))

    def test_explained_has_single_fluctuation_only(self):
        events = simulate("explained", ANCHOR)
        rhr = [e["value"] for e in events if e["metric"] == "rhr"]
        self.assertGreater(rhr[59], 64 * 1.18)
        self.assertLess(max(rhr[:59] + rhr[60:]), 64 * 1.02)

    def test_review_events_equal_ambiguous_events(self):
        self.assertEqual(simulate("review", ANCHOR), simulate("ambiguous", ANCHOR))


if __name__ == "__main__":
    unittest.main()

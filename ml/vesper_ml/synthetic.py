"""Synthetic scenarios.

`simulate` reproduces `shared/engine.js` `simulate()` value for value so the
three seeded demo patients score identically here and in the JS engine.
Additional scenarios (added in later milestones) model realistic wearable
cadence and missingness. All data here is synthetic; nothing is derived from
a real person.
"""

import math
import time

from .metrics import LEGACY_METRICS, METRICS

HOUR_MS = 3_600_000
STEP_MS = 6 * HOUR_MS

ENGINE_SHIFTS = {"rhr": 0.14, "hrv": -0.24, "respiratory": 0.17, "sleep": -0.22, "glucose": 0.19, "spo2": 0.0}
ENGINE_SCENARIOS = ("ambiguous", "explained", "review")


def _js_round1(x):
    """Math.round(x * 10) / 10 for positive x."""
    return math.floor(x * 10 + 0.5) / 10


def _iso(ms):
    from .contracts import from_epoch_ms, to_iso

    return to_iso(from_epoch_ms(ms))


def simulate(scenario="ambiguous", anchor_ms=None):
    """Port of engine.simulate: 63 six-hourly points for the six legacy metrics."""
    if scenario not in ENGINE_SCENARIOS:
        raise ValueError(f"unknown engine scenario '{scenario}'")
    anchor_ms = int(time.time() * 1000) if anchor_ms is None else int(anchor_ms)
    end = (anchor_ms // STEP_MS) * STEP_MS
    events = []
    for i in range(63):
        for idx, key in enumerate(LEGACY_METRICS):
            m = METRICS[key]
            recent = i >= 56
            fluctuation = scenario == "explained" and i == 59 and key in ("rhr", "glucose")
            if recent and scenario != "explained":
                shift = ENGINE_SHIFTS[key]
            elif fluctuation:
                shift = 0.2
            else:
                shift = 0.0
            value = _js_round1(m.base * (1 + shift + math.sin(i * 1.7 + idx) * 0.017))
            events.append(
                {
                    "metric": key,
                    "value": value,
                    "unit": m.unit,
                    "timestamp": _iso(end - (62 - i) * STEP_MS),
                    "source": f"Simulated {m.source}",
                }
            )
    return events


ENGINE_CONTEXT = {
    "review": {
        "exercise": "No unusual activity",
        "fatigue": "Worsening",
        "medication": "No changes",
        "consent": True,
    },
    "explained": {
        "exercise": "Recorded workout and meal",
        "fatigue": "Not reported",
        "medication": "Not reported",
        "consent": True,
    },
    "ambiguous": None,
}

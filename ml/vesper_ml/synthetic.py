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


# ---------------------------------------------------------------------------
# Realistic-cadence scenarios
# ---------------------------------------------------------------------------

DAY_MS = 24 * HOUR_MS

# Per-metric sampling profile: (samples per day, probability a day has data, noise sd as fraction of level)
CADENCE = {
    "rhr": (1, 0.6, 0.03),
    "hrv": (3, 0.7, 0.12),
    "respiratory": (2, 0.75, 0.05),
    "spo2": (4, 0.9, 0.008),
    "sleep": (1, 0.7, 0.12),
    "steps": (4, 0.95, 0.35),
    "heart_rate": (4, 0.95, 0.06),
    "walking_speed": (1, 0.97, 0.05),
    "step_length": (1, 0.97, 0.05),
    "walking_asymmetry": (1, 0.95, 0.2),
    "double_support": (1, 0.97, 0.05),
    "walking_steadiness": (1 / 7, 1.0, 0.04),
}
SOURCE_OF = {
    "rhr": "wearable", "hrv": "wearable", "respiratory": "wearable", "spo2": "wearable", "sleep": "wearable", "heart_rate": "wearable",
    "steps": "phone", "walking_speed": "phone", "step_length": "phone", "walking_asymmetry": "phone", "double_support": "phone",
    "walking_steadiness": "phone",
}
POSTOP_LEVELS = {"rhr": 66, "hrv": 42, "respiratory": 15, "spo2": 97.5, "sleep": 7.2, "steps": 900, "heart_rate": 74}
GAIT_LEVELS = {"walking_speed": 1.05, "step_length": 62, "walking_asymmetry": 4.0, "double_support": 30, "walking_steadiness": 72, "steps": 1200}

SCENARIO_PROGRAM = {
    "ambiguous": "post_abdominal_surgery",
    "explained": "post_abdominal_surgery",
    "review": "post_abdominal_surgery",
    "postoperative_drift": "post_abdominal_surgery",
    "missing_sensor": "post_abdominal_surgery",
    "gait_decline": "stroke_rehabilitation",
}
SCENARIOS = tuple(SCENARIO_PROGRAM)


def synthetic_patient(levels, days, anchor_ms, seed, drift=None, drift_days=0, dropout=None, dropout_days=0, trend=None):
    """Generate realistic-cadence events for one synthetic patient.

    levels:  metric -> typical level for this patient
    drift:   metric -> fractional change reached at the end of the period,
             ramped linearly over the final `drift_days` days
    dropout: metrics that stop reporting for the final `dropout_days` days
    trend:   metric -> fractional change across the whole period (slow recovery)
    """
    import numpy as np

    from .metrics import METRICS

    rng = np.random.default_rng(seed)
    end = (anchor_ms // STEP_MS) * STEP_MS
    start = end - days * DAY_MS
    events = []
    for metric, level in levels.items():
        per_day, p_day, noise = CADENCE[metric]
        m = METRICS[metric]
        day = 0
        while day < days:
            day_start = start + day * DAY_MS
            if per_day < 1:
                # weekly-ish metric: sample every round(1/per_day) days
                stride = int(round(1 / per_day))
                take = day % stride == 0
                n_samples = 1 if take else 0
            else:
                n_samples = per_day if rng.random() < p_day else 0
            if dropout and metric in dropout and day >= days - dropout_days:
                n_samples = 0
            for k in range(n_samples):
                if per_day >= 1:
                    slot = k * (DAY_MS // per_day) + int(rng.integers(0, max(1, DAY_MS // per_day // 2)))
                else:
                    slot = 8 * HOUR_MS
                t = day_start + slot
                if t > end:
                    continue
                frac_day = (t - start) / (days * DAY_MS)
                value = level
                if trend and metric in trend:
                    value *= 1 + trend[metric] * frac_day
                if drift and metric in drift and drift_days > 0:
                    ramp = max(0.0, (t - (end - drift_days * DAY_MS)) / (drift_days * DAY_MS))
                    value *= 1 + drift[metric] * min(1.0, ramp)
                value *= 1 + rng.normal(0, noise)
                if metric == "spo2":
                    value = min(value, 100.0)
                value = max(value, 0.0 if m.lo < 0 else 0.1)
                events.append(
                    {
                        "metric": metric,
                        "value": round(float(value), 3 if metric in ("walking_speed",) else 1),
                        "unit": m.unit,
                        "timestamp": _iso(int(t)),
                        "source": SOURCE_OF[metric],
                    }
                )
            day += 1
    # deduplicate metric/timestamp collisions deterministically (keep first)
    seen = set()
    out = []
    for e in events:
        key = (e["metric"], e["timestamp"])
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    out.sort(key=lambda e: (e["timestamp"], e["metric"]))
    return out


POSTOP_DRIFT = {"rhr": 0.13, "hrv": -0.28, "respiratory": 0.20, "spo2": -0.015, "sleep": -0.22, "steps": -0.40, "heart_rate": 0.10}
GAIT_DECLINE = {"walking_speed": -0.28, "step_length": -0.18, "walking_asymmetry": 1.0, "double_support": 0.22, "steps": -0.40}
POSTOP_CONTEXT = {
    "exercise": "No unusual activity",
    "fatigue": "Worsening",
    "medication": "No changes",
    "pain_change": "Worse",
    "wound_concern": False,
    "nausea_vomiting": False,
    "shortness_of_breath": True,
    "fever_symptoms": False,
    "consent": True,
}
GAIT_CONTEXT = {"exercise": "No unusual activity", "fatigue": "Worsening", "medication": "No changes", "falls": False, "dizziness": True, "therapy_adherence": "Missed sessions", "consent": True}


def scenario(name, anchor_ms=None, seed=0):
    """Return (events, context) for a named scenario. Context is the structured
    check-in a demo would collect for it; callers decide whether to pass it."""
    anchor_ms = int(time.time() * 1000) if anchor_ms is None else int(anchor_ms)
    if name in ENGINE_SCENARIOS:
        return simulate(name, anchor_ms), ENGINE_CONTEXT[name]
    if name == "postoperative_drift":
        return synthetic_patient(POSTOP_LEVELS, 28, anchor_ms, seed, drift=POSTOP_DRIFT, drift_days=4), POSTOP_CONTEXT
    if name == "missing_sensor":
        return (
            synthetic_patient(POSTOP_LEVELS, 28, anchor_ms, seed, dropout={"rhr", "hrv", "respiratory", "spo2", "sleep", "heart_rate"}, dropout_days=3),
            None,
        )
    if name == "gait_decline":
        return (
            synthetic_patient(GAIT_LEVELS, 42, anchor_ms, seed, drift=GAIT_DECLINE, drift_days=4, trend={"walking_speed": 0.10, "step_length": 0.06, "steps": 0.25}),
            GAIT_CONTEXT,
        )
    raise ValueError(f"unknown scenario '{name}'. Choose one of: {', '.join(SCENARIOS)}")


def population(n_patients, days, anchor_ms, seed, levels=POSTOP_LEVELS, benign_fraction=0.3):
    """Synthetic training population for the prior model: varied levels and
    noise, no persistent drift; some patients get a one-day benign bump."""
    import numpy as np

    rng = np.random.default_rng(seed)
    patients = []
    for i in range(n_patients):
        lv = {m: v * float(rng.uniform(0.85, 1.15)) for m, v in levels.items()}
        if "spo2" in lv:
            lv["spo2"] = min(99.0, max(94.0, lv["spo2"]))
        drift, drift_days = None, 0
        if rng.random() < benign_fraction:
            drift = {"rhr": 0.08, "heart_rate": 0.1, "steps": 0.6}
            drift_days = 1
        patients.append(synthetic_patient(lv, days, anchor_ms, int(rng.integers(0, 2**31 - 1)), drift=drift, drift_days=drift_days))
    return patients

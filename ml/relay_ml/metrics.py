"""Metric registry.

The first six entries mirror `shared/engine.js` exactly (label, unit, colour,
source, demo base value and percent threshold) so evidence produced here is
drop-in compatible with the current UI. The remaining entries are internal
metrics the JS engine does not know about; they use the same event shape but
must not be sent to the JS engine.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    unit: str
    source: str
    color: str
    base: float
    threshold: float  # legacy percent threshold from the JS engine
    lo: float  # exclusive lower bound for a valid value
    hi: float  # inclusive upper bound
    legacy: bool = False  # True when shared/engine.js accepts this metric


_M = [
    # Legacy metrics: identical to shared/engine.js METRICS.
    Metric("rhr", "Resting heart rate", "bpm", "Wearable", "#c77b57", 64, 10, 0, 1000, True),
    Metric("hrv", "Heart rate variability", "ms", "Wearable", "#728db5", 48, 15, 0, 1000, True),
    Metric("respiratory", "Respiratory rate", "/min", "Wearable", "#8b80ab", 14, 10, 0, 1000, True),
    Metric("sleep", "Sleep duration", "h", "Sleep tracker", "#aa9361", 7.6, 15, 0, 1000, True),
    Metric("glucose", "Glucose", "mg/dL", "CGM", "#668f84", 105, 15, 0, 1000, True),
    Metric("spo2", "Oxygen saturation", "%", "Pulse oximeter", "#95a49a", 98, 3, 0, 1000, True),
    # Internal metrics (superset). Not validated by the JS engine.
    Metric("heart_rate", "Heart rate", "bpm", "Wearable", "#b06a5a", 72, 10, 0, 300),
    Metric("steps", "Steps", "count", "Phone", "#7a9a6a", 6000, 30, -1, 200000),
    Metric("walking_speed", "Walking speed", "m/s", "Phone", "#6a8aa0", 1.2, 15, 0, 10),
    Metric("step_length", "Step length", "cm", "Phone", "#8a7aa0", 70, 15, 0, 300),
    Metric("walking_asymmetry", "Walking asymmetry", "%", "Phone", "#a08a6a", 3, 50, -1, 100),
    Metric("double_support", "Double support", "%", "Phone", "#6aa090", 28, 15, 0, 100),
    Metric("walking_steadiness", "Walking steadiness", "%", "Phone", "#90a06a", 80, 15, 0, 100),
    Metric("temperature", "Temperature", "degC", "Thermometer", "#c0705a", 36.8, 3, 0, 60),
    Metric("weight", "Weight", "kg", "Scale", "#7a7a9a", 78, 3, 0, 500),
    Metric("systolic_bp", "Systolic blood pressure", "mmHg", "BP cuff", "#a06a7a", 122, 10, 0, 300),
    Metric("diastolic_bp", "Diastolic blood pressure", "mmHg", "BP cuff", "#7a6aa0", 78, 10, 0, 300),
]

METRICS = {m.key: m for m in _M}
LEGACY_METRICS = [m.key for m in _M if m.legacy]

"""Condition-specific configuration for one shared anomaly engine.

These are monitoring programs, not diagnostic classifiers. A program lists
which metrics matter, how many must move together, and which structured
check-in answers an illustrative protocol rule reacts to. Protocol rules sit
entirely outside the unsupervised model and are placeholders for
clinician-defined protocols; they are not clinically validated.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProtocolRule:
    field: str
    equals: object
    note: str


@dataclass(frozen=True)
class Program:
    key: str
    title: str
    metrics: tuple  # every metric the program can use
    core: tuple  # metrics that count toward coverage
    context_fields: tuple  # structured check-in fields relevant to this program
    protocol_rules: tuple = field(default_factory=tuple)
    min_coordinated: int = 3  # flagged signals needed for the deterministic rule
    deviation_threshold: float = 1.5  # robust deviation magnitude that counts
    min_persistence_hours: float = 24.0
    min_persistence_windows: int = 3
    baseline_days: int = 28
    min_baseline_points: int = 8
    min_baseline_span_hours: float = 72.0
    coverage_sufficient: float = 0.6
    coverage_partial: float = 0.3
    validation_quantile: float = 0.95
    note: str = ""


COMMON_CONTEXT = ("exercise", "fatigue", "medication")

PROGRAMS = {
    "post_abdominal_surgery": Program(
        key="post_abdominal_surgery",
        title="Major abdominal-surgery recovery",
        metrics=("rhr", "hrv", "respiratory", "spo2", "sleep", "steps", "heart_rate", "temperature", "glucose"),
        core=("rhr", "hrv", "respiratory", "spo2", "sleep"),
        context_fields=COMMON_CONTEXT
        + ("pain_change", "wound_concern", "nausea_vomiting", "shortness_of_breath", "fever_symptoms"),
        protocol_rules=(
            ProtocolRule("shortness_of_breath", True, "Patient reported new shortness of breath during check-in."),
            ProtocolRule("fever_symptoms", True, "Patient reported fever symptoms during check-in."),
        ),
        note="Primary demonstration program: first 14 days at home after major abdominal surgery.",
    ),
    "copd_recovery": Program(
        key="copd_recovery",
        title="COPD-exacerbation recovery",
        metrics=("spo2", "respiratory", "rhr", "heart_rate", "sleep", "steps"),
        core=("spo2", "respiratory", "rhr", "sleep"),
        context_fields=COMMON_CONTEXT + ("breathlessness", "cough", "mucus_change", "inhaler_use", "oxygen_use"),
        protocol_rules=(ProtocolRule("breathlessness", "Worsening", "Patient reported worsening breathlessness."),),
    ),
    "pneumonia_recovery": Program(
        key="pneumonia_recovery",
        title="Pneumonia recovery",
        metrics=("spo2", "respiratory", "rhr", "heart_rate", "sleep", "steps", "temperature"),
        core=("spo2", "respiratory", "rhr", "sleep"),
        context_fields=COMMON_CONTEXT + ("cough", "breathing_difficulty", "antibiotic_adherence", "hydration", "fever_symptoms"),
        protocol_rules=(ProtocolRule("fever_symptoms", True, "Patient reported fever symptoms during check-in."),),
    ),
    "heart_failure_recovery": Program(
        key="heart_failure_recovery",
        title="Heart-failure recovery",
        metrics=("rhr", "heart_rate", "respiratory", "spo2", "sleep", "steps", "weight", "systolic_bp", "diastolic_bp"),
        core=("rhr", "respiratory", "spo2", "weight", "sleep"),
        context_fields=COMMON_CONTEXT + ("swelling", "breathlessness", "diuretic_adherence"),
        protocol_rules=(ProtocolRule("swelling", "Worsening", "Patient reported worsening swelling."),),
    ),
    "stroke_rehabilitation": Program(
        key="stroke_rehabilitation",
        title="Stroke rehabilitation (functional recovery only)",
        metrics=("walking_speed", "step_length", "walking_asymmetry", "double_support", "walking_steadiness", "steps"),
        core=("walking_speed", "step_length", "walking_asymmetry", "double_support", "steps"),
        context_fields=COMMON_CONTEXT + ("falls", "dizziness", "therapy_adherence"),
        protocol_rules=(ProtocolRule("falls", True, "Patient reported a fall during check-in."),),
        min_persistence_hours=48.0,
        note="Monitors functional recovery. It does not detect or rule out a new stroke; new neurological symptoms follow emergency guidance outside this model.",
    ),
    "cardiac_recovery": Program(
        key="cardiac_recovery",
        title="Cardiac recovery after MI, PCI, or CABG",
        metrics=("rhr", "heart_rate", "hrv", "sleep", "steps", "systolic_bp", "diastolic_bp", "weight"),
        core=("rhr", "hrv", "sleep", "steps"),
        context_fields=COMMON_CONTEXT + ("chest_symptoms", "dizziness", "breathlessness"),
        protocol_rules=(ProtocolRule("chest_symptoms", True, "Patient reported chest symptoms during check-in."),),
    ),
}

DEFAULT_PROGRAM = "post_abdominal_surgery"


def get_program(key):
    if key is None:
        return PROGRAMS[DEFAULT_PROGRAM]
    if key not in PROGRAMS:
        raise KeyError(f"Unknown program '{key}'. Choose one of: {', '.join(PROGRAMS)}")
    return PROGRAMS[key]

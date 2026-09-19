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
    "sepsis_watch": Program(
        key="sepsis_watch",
        title="Post-discharge recovery after surgery",
        metrics=("rhr", "hrv", "respiratory", "spo2", "sleep", "temperature", "heart_rate", "steps"),
        core=("rhr", "hrv", "respiratory", "temperature"),
        context_fields=COMMON_CONTEXT + ("fever_symptoms", "pain_change", "wound_concern"),
        protocol_rules=(
            ProtocolRule("fever_symptoms", True, "Patient reported fever symptoms during check-in."),
        ),
        min_coordinated=3,
        note="Post-surgical sepsis watch. Surfaces coordinated change; it does not detect or exclude sepsis.",
    ),
    "respiratory_infection": Program(
        key="respiratory_infection",
        title="Respiratory-infection recovery",
        metrics=("respiratory", "temperature", "spo2", "hrv", "rhr", "sleep", "heart_rate", "steps"),
        core=("respiratory", "temperature", "spo2", "hrv", "rhr"),
        context_fields=COMMON_CONTEXT + ("cough_change", "fever_symptoms", "shortness_of_breath"),
        protocol_rules=(
            ProtocolRule("shortness_of_breath", True, "Patient reported new shortness of breath during check-in."),
        ),
        min_coordinated=3,
        note="Recovery after influenza or a comparable respiratory infection.",
    ),
    "asthma_recovery": Program(
        key="asthma_recovery",
        title="Asthma-flare recovery",
        metrics=("respiratory", "spo2", "sleep", "heart_rate", "rhr", "hrv", "steps"),
        core=("respiratory", "spo2", "sleep", "heart_rate"),
        context_fields=COMMON_CONTEXT + ("cough_change", "shortness_of_breath", "inhaler_use"),
        protocol_rules=(
            ProtocolRule("shortness_of_breath", True, "Patient reported new shortness of breath during check-in."),
        ),
        note="Recovery after an asthma flare.",
    ),
    "pulmonary_embolism_recovery": Program(
        key="pulmonary_embolism_recovery",
        title="Pulmonary-embolism recovery",
        metrics=("respiratory", "spo2", "rhr", "heart_rate", "hrv", "sleep", "steps"),
        core=("respiratory", "spo2", "rhr", "heart_rate"),
        context_fields=COMMON_CONTEXT + ("shortness_of_breath", "pain_change"),
        protocol_rules=(
            ProtocolRule("shortness_of_breath", True, "Patient reported new shortness of breath during check-in."),
        ),
        note="Monitors recovery only. It cannot detect a new embolism; acute symptoms follow the discharge letter's instructions, outside this model.",
    ),
    "sleep_apnoea_titration": Program(
        key="sleep_apnoea_titration",
        title="Sleep apnea, post-titration",
        metrics=("spo2", "sleep", "rhr", "respiratory", "hrv", "heart_rate"),
        core=("spo2", "sleep", "rhr"),
        context_fields=COMMON_CONTEXT + ("daytime_sleepiness", "device_adherence"),
        min_persistence_hours=48.0,
        note="Confirms therapy is holding after a titration study. Spot SpO2 cannot resolve individual desaturation events.",
    ),
    "postpartum_recovery": Program(
        key="postpartum_recovery",
        title="Postpartum recovery",
        metrics=("rhr", "respiratory", "sleep", "temperature", "hrv", "spo2", "steps"),
        core=("rhr", "respiratory", "sleep", "temperature"),
        context_fields=COMMON_CONTEXT + ("bleeding_change", "headache_vision", "fever_symptoms"),
        protocol_rules=(
            ProtocolRule("headache_vision", True, "Patient reported headache or vision changes during check-in."),
            ProtocolRule("bleeding_change", True, "Patient reported heavier bleeding during check-in."),
        ),
        note="Recovery after birth. Blood pressure is not collected, so conditions defined by it are out of scope.",
    ),
    "joint_replacement_recovery": Program(
        key="joint_replacement_recovery",
        title="Hip or knee replacement recovery",
        metrics=("walking_speed", "step_length", "double_support", "steps", "walking_asymmetry", "walking_steadiness", "rhr", "sleep", "heart_rate"),
        core=("walking_speed", "step_length", "double_support", "steps"),
        context_fields=COMMON_CONTEXT + ("pain_change", "swelling", "falls", "wound_concern"),
        protocol_rules=(ProtocolRule("falls", True, "Patient reported a fall during check-in."),),
        min_coordinated=2,
        min_persistence_hours=48.0,
        note="A CMS HRRP condition. Gait speed, step length and double-support are the recovery markers over 13-24 weeks. Monitors functional recovery only.",
    ),
    "post_chemotherapy": Program(
        key="post_chemotherapy",
        title="Recovery after chemotherapy",
        metrics=("temperature", "rhr", "hrv", "respiratory", "spo2", "sleep", "heart_rate", "weight", "steps"),
        core=("temperature", "rhr", "hrv", "respiratory"),
        context_fields=COMMON_CONTEXT + ("fever_symptoms", "mouth_sores", "nausea_vomiting"),
        protocol_rules=(ProtocolRule("fever_symptoms", True, "Patient reported fever symptoms during check-in."),),
        min_coordinated=2,
        note="Watches for the temperature and heart-rate pattern that precedes febrile neutropenia. Surfaces the pattern; it does not detect or exclude infection.",
    ),
    "stroke_rehabilitation": Program(
        key="stroke_rehabilitation",
        title="Stroke rehabilitation (functional recovery only)",
        metrics=("walking_speed", "step_length", "walking_asymmetry", "double_support", "walking_steadiness", "steps"),
        core=("walking_speed", "step_length", "walking_asymmetry", "double_support", "steps"),
        context_fields=COMMON_CONTEXT + ("falls", "dizziness", "therapy_adherence", "diet_change"),
        protocol_rules=(ProtocolRule("falls", True, "Patient reported a fall during check-in."),),
        min_persistence_hours=48.0,
        note="Monitors functional recovery. It does not detect or rule out a new stroke; new neurological symptoms follow the discharge letter's instructions, outside this model.",
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

import { QUESTIONS } from "../model/profiles.js";

const MODEL_STATUS = {
  monitoring: "no unusual pattern identified",
  context_needed: "unusual pattern; patient context is needed",
  review_recommended: "unusual pattern; clinician review is recommended",
  insufficient_data: "insufficient data for a model assessment",
};

const readable = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

const joinNaturally = (items) =>
  items.length < 2
    ? items[0] || ""
    : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

function spokenUnit(unit) {
  return (
    {
      "per min": "per minute",
      bpm: "beats per minute",
      "%": "percent",
      "°C": "degrees Celsius",
      ms: "milliseconds",
      kg: "kilograms",
      "m/s": "meters per second",
      hours: "hours",
      "/10": "out of ten",
    }[unit] || unit
  );
}

function describeSignal(signal) {
  if (signal.today === null) return `${signal.plain} has no reading today`;

  const value = `${signal.fmt(signal.today)} ${spokenUnit(signal.unit)}`;
  const change = String(signal.change || "").match(/^([+-])?([\d.]+)\s*(.*)$/);
  if (!change) return `${signal.plain} is ${value}`;

  const [, sign, amount, unit] = change;
  const spokenChangeUnit =
    unit === "%"
      ? "percent"
      : unit === "points"
        ? "percentage points"
        : spokenUnit(unit);
  const direction = sign === "-" ? "below" : "above";
  const duration = signal.towardDays
    ? ` and has stayed that way for ${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
    : "";
  return `${signal.plain} is ${value}, about ${amount} ${spokenChangeUnit} ${direction} usual${duration}`;
}

// Build a conversational briefing from the same readings shown to clinicians.
// It deliberately excludes patient names, identifiers, and free-text notes.
export function buildClinicianSummary(
  patient,
  analysis = patient.analysis,
  fresh = false,
) {
  const moved = (patient.moved || []).slice(0, 4);
  const after = patient.profile?.after || "discharge";
  const countedCount = patient.counted?.length || moved.length;
  const parts = [
    `Recovery update: day ${patient.dayHome} of ${patient.windowDays} at home after ${after}.`,
  ];

  const status =
    patient.status === "review"
      ? "Priority: clinician review is recommended."
      : patient.status === "context"
        ? "A patient check-in is requested to add context."
        : patient.status === "nodata"
          ? "There are not enough recent readings for a reliable comparison."
          : "No clinician review is requested right now.";
  parts.push(status);

  if (moved.length) {
    const count = `${moved.length} of ${countedCount} watched ${countedCount === 1 ? "signal" : "signals"}`;
    const persistence = patient.pattern
      ? `, and the pattern has lasted ${patient.hours} hours`
      : "";
    parts.push(
      `The recovery watch found that ${count} ${moved.length === 1 ? "has" : "have"} moved away from this patient's usual${persistence}. ${joinNaturally(moved.map(describeSignal))}.`,
    );
  } else if (patient.status !== "nodata") {
    parts.push(
      "No watched reading is currently past its persistent threshold compared with this patient's usual.",
    );
  }

  if (analysis) {
    const modelState =
      MODEL_STATUS[analysis.application_state] ||
      readable(analysis.application_state) ||
      "state unavailable";
    parts.push(
      `${fresh ? "The latest Relay model assessment" : "The most recent Relay model assessment"} is ${modelState}.`,
    );
    if (typeof analysis.anomaly_score === "number")
      parts.push(
        `Its anomaly score is ${analysis.anomaly_score.toFixed(2)} on a scale from zero to one.`,
      );
    const contributors = (analysis.contributors || [])
      .slice(0, 3)
      .map((item) => {
        const direction =
          item.direction === "above_baseline" ? "higher" : "lower";
        return `${item.label || item.metric} ${direction} than this patient's usual`;
      });
    if (contributors.length)
      parts.push(
        `The strongest model signals were ${joinNaturally(contributors)}.`,
      );
  } else {
    parts.push(
      "A trained-model score is not included in this briefing, so these findings come from the wearable readings and recovery-watch thresholds.",
    );
  }

  if (patient.answered?.answers) {
    const responses = Object.entries(patient.answered.answers)
      .filter(([, answer]) => answer)
      .slice(0, 4)
      .map(([question, answer]) => {
        const topic =
          {
            breathing: "breathing with usual activity",
            cough: "cough or mucus",
            fever: "fever or chills",
            swelling: "ankle or leg swelling",
            pain: "incision pain",
            wound: "wound appearance",
            nausea: "nausea or vomiting",
            mucus: "mucus",
            inhaler: "rescue inhaler use",
            oxygen: "prescribed oxygen use",
            fatigue: "fatigue",
            dizziness: "dizziness",
            hydration: "hydration",
            medicine: "medication",
            activity: "activity",
          }[question] ||
          QUESTIONS[question]?.short?.toLowerCase() ||
          readable(question);
        return answer === "No"
          ? `no change in ${topic}`
          : answer === "Yes"
            ? `${topic} was reported`
            : answer === "Not sure"
              ? `uncertainty about ${topic}`
              : `${answer.toLowerCase()} worsening in ${topic}`;
      });
    if (responses.length)
      parts.push(
        `In the latest check-in, the patient reported ${joinNaturally(responses)}.`,
      );
  }

  parts.push(
    "This summary describes recorded information for clinician review. It is not a diagnosis or treatment recommendation.",
  );
  return parts.join(" ");
}

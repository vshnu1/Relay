const WATCH_STATUS = {
  review: "review recommended",
  context: "patient context requested",
  monitoring: "monitoring; no review currently requested",
  nodata: "not enough recent data to assess",
};

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

// Build a short, deterministic briefing from the same evidence the clinician
// sees. It deliberately excludes patient names, identifiers, and free-text notes.
export function buildClinicianSummary(
  patient,
  analysis = patient.analysis,
  fresh = false,
) {
  const moved = (patient.moved || []).slice(0, 4);
  const parts = [
    "Relay clinician briefing. Synthetic demo data.",
    `Discharge pathway: recovery after ${patient.profile.after}, day ${patient.dayHome} of ${patient.windowDays} at home.`,
    `Recovery watch status: ${WATCH_STATUS[patient.status] || readable(patient.status)}.`,
  ];

  if (moved.length) {
    const findings = moved.map((signal) => {
      const duration = signal.towardDays
        ? `, away from usual for ${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
        : "";
      const today =
        signal.today === null
          ? "no reading today"
          : `${signal.fmt(signal.today)} ${signal.unit}, ${signal.change} from usual`;
      return `${signal.plain}: ${today}${duration}`;
    });
    parts.push(
      `Signals past their persistent watch thresholds: ${findings.join("; ")}.`,
    );
  } else if (patient.status === "nodata") {
    parts.push(
      "There are not enough recent wearable readings for a threshold comparison.",
    );
  } else {
    parts.push(
      "No counted wearable signal is currently past its persistent watch threshold.",
    );
  }

  if (analysis) {
    const modelState =
      MODEL_STATUS[analysis.application_state] ||
      readable(analysis.application_state) ||
      "state unavailable";
    parts.push(
      `${fresh ? "Fresh Relay model result" : "Most recent Relay model result"}: ${modelState}.`,
    );
    if (typeof analysis.anomaly_score === "number")
      parts.push(`Model anomaly score: ${analysis.anomaly_score.toFixed(2)}.`);
    const contributors = (analysis.contributors || [])
      .slice(0, 3)
      .map((item) => {
        const direction =
          item.direction === "above_baseline" ? "higher" : "lower";
        return `${item.label || item.metric} ${direction} than this patient's usual`;
      });
    if (contributors.length)
      parts.push(`Model contributors: ${contributors.join("; ")}.`);
  } else {
    parts.push(
      "Relay has not returned a score for this briefing. The summary is based on the recovery watch rules and readings only.",
    );
  }

  if (patient.answered?.answers) {
    const responses = Object.entries(patient.answered.answers)
      .filter(([, answer]) => answer)
      .slice(0, 4)
      .map(([question, answer]) => `${readable(question)}: ${answer}`);
    if (responses.length)
      parts.push(
        `Latest structured check-in responses: ${responses.join("; ")}.`,
      );
  }

  parts.push(
    "This is a summary of recorded data, not a diagnosis or treatment recommendation.",
  );
  return parts.join(" ");
}

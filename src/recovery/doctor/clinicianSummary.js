const WATCHED_SIGNAL_LIMIT = 4;

const STATUS_COPY = {
  review: "Review recommended.",
  context: "Patient follow-up is needed.",
  nodata: "There are not enough recent readings for a reliable update.",
  monitoring: "No concerning changes are flagged today.",
};

const SYMPTOMS = {
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
  racing: "racing or irregular heartbeat",
  chest: "chest pain or pressure",
};

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
      points: "points",
      "/10": "out of ten",
    }[unit] || unit
  );
}

function signalUpdate(signal) {
  const label = signal.plain || signal.name || "Reading";
  if (signal.today === null) return `${label} has no reading today`;

  const value = `${signal.fmt(signal.today)} ${spokenUnit(signal.unit)}`;
  const delta = String(signal.change || "").match(/^([+-])?([\d.]+)\s*(.*)$/);
  if (!delta) return `${label} is ${value}`;

  const [, sign, amount, unit] = delta;
  const direction = sign === "-" ? "below" : "above";
  const changeUnit = unit === "%" ? "percent" : spokenUnit(unit);
  const duration = signal.towardDays
    ? ` for ${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
    : "";
  return `${label} is ${value}, ${amount} ${changeUnit} ${direction} usual${duration}`;
}

function patientConcerns(patient) {
  return Object.entries(patient.answered?.answers || {})
    .filter(([, answer]) => answer && answer !== "No")
    .map(([key, answer]) => {
      const topic = SYMPTOMS[key];
      if (!topic || key === "medicine" || key === "activity") return null;
      if (answer === "Not sure") return `unsure about ${topic}`;
      if (answer === "Yes") return `reports ${topic}`;
      const intensity = answer === "A lot" ? "much worse" : "a little worse";
      return `${topic} is ${intensity}`;
    })
    .filter(Boolean)
    .slice(0, 2);
}

function joinConcerns(items) {
  if (items.length < 2) return items[0] || "";
  return `${items[0]} and ${items[1]}`;
}

// A short, name-free update focused on current concerns and patient-reported
// symptoms. The audio transcript does not narrate implementation details.
export function buildClinicianSummary(patient, analysis = patient.analysis) {
  const moved = (patient.moved || []).slice(0, WATCHED_SIGNAL_LIMIT);
  const concerns = patientConcerns(patient);
  const modelState = analysis?.application_state;
  const modelFlagsReview = modelState === "review_recommended";
  const modelRequestsContext = modelState === "context_needed";
  const review = patient.status === "review" || modelFlagsReview;
  const needsContext = patient.status === "context" || modelRequestsContext;

  if (patient.status === "nodata" && !concerns.length && !modelFlagsReview)
    return STATUS_COPY.nodata;

  const parts = [];
  if (review) parts.push("Review recommended.");
  else if (needsContext || concerns.length)
    parts.push("Patient follow-up is needed.");
  else parts.push(STATUS_COPY.monitoring);

  if (moved.length) {
    const count = patient.counted?.length || moved.length;
    const duration =
      patient.pattern && patient.hours ? ` for ${patient.hours} hours` : "";
    parts.push(
      `${moved.length} of ${count} watched readings remain outside the patient's usual range${duration}: ${moved.map(signalUpdate).join("; ")}.`,
    );
  } else if (modelFlagsReview || modelRequestsContext) {
    const contributors = (analysis.contributors || [])
      .slice(0, 2)
      .map((item) => item.label || item.metric)
      .filter(Boolean);
    parts.push(
      contributors.length
        ? `Relay flagged a change in ${joinConcerns(contributors)}.`
        : "Relay flagged a change that needs clinician review.",
    );
  } else if (!concerns.length && patient.profile?.after) {
    parts.push(
      `Recovery after ${patient.profile.after} is on day ${patient.dayHome} of ${patient.windowDays}.`,
    );
  }

  if (concerns.length)
    parts.push(`The patient reports ${joinConcerns(concerns)}.`);

  return parts.join(" ");
}

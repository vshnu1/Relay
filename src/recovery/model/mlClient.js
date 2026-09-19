// The patient view's bridge to the Python model. Readings in the app's own shape
// become the event contract the model validates, and the model's evidence object
// comes back with the application state, the anomaly score and the contributors.
// The model never runs in the browser; the API spawns it.
import { PROFILES, SIGNALS, toModelContext } from "./profiles.js";

// app signal -> [model metric, unit]. Signals with no model counterpart are left out.
export const METRIC_MAP = {
  restingHr: ["rhr", "bpm"],
  hrv: ["hrv", "ms"],
  breathing: ["respiratory", "/min"],
  oxygen: ["spo2", "%"],
  sleep: ["sleep", "h"],
  avgHr: ["heart_rate", "bpm"],
  weight: ["weight", "kg"],
  temperature: ["temperature", "degC"],
};
const SOURCE = {
  watch: "wearable",
  whoop: "wearable",
  manual: "manual",
  phone: "phone",
};
const LIMIT = {
  rhr: [0, 1000],
  hrv: [0, 1000],
  respiratory: [0, 1000],
  spo2: [0, 100],
  sleep: [0, 1000],
  heart_rate: [0, 300],
  weight: [0, 500],
  temperature: [0, 60],
};

export function toModelEvents(readings) {
  const events = [];
  const seen = new Set();
  for (const [signal, list] of Object.entries(readings || {})) {
    const map = METRIC_MAP[signal];
    if (!map) continue;
    const [metric, unit] = map;
    const [lo, hi] = LIMIT[metric];
    for (const r of list) {
      const ms = Math.round(r.t);
      const key = `${metric}:${ms}`;
      if (seen.has(key) || !(r.v > lo && r.v <= hi)) continue;
      seen.add(key);
      events.push({
        metric,
        value: Number(r.v),
        unit,
        timestamp: new Date(ms).toISOString(),
        source: SOURCE[SIGNALS[signal].device] || "unknown",
      });
    }
  }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function buildRequest(patient, answers = null) {
  const program = PROFILES[patient.profileId ?? patient.profile]?.ml ?? null;
  return {
    program,
    patient_id: patient.id,
    events: toModelEvents(patient.readings),
    context: answers
      ? toModelContext(patient.profileId ?? patient.profile, answers)
      : null,
  };
}

function authHeaders() {
  const headers = { "content-type": "application/json" };
  try {
    const code = sessionStorage.getItem("rx-code");
    if (code) headers.authorization = `Bearer ${code}`;
  } catch {
    // no session storage: local demo without codes
  }
  return headers;
}

// Resolves to the evidence object, or throws with a message the screen can show.
export async function scoreWithModel(patient, answers = null, fetchFn = fetch) {
  const request = buildRequest(patient, answers);
  if (!request.program)
    throw new Error(
      `No model program is defined for ${PROFILES[patient.profileId ?? patient.profile]?.name || "this recovery"} yet.`,
    );
  if (request.events.length < 8)
    throw new Error(
      "Not enough readings to score yet. Connect a device or import your Health data.",
    );
  const res = await fetchFn("/api/ml/score", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok)
    throw new Error(
      body?.error || `The model could not be reached (${res.status}).`,
    );
  return { ...body, scoredAt: Date.now(), withContext: !!answers };
}

// Plain-words reading of the model's result for the patient.
export function describeAnalysis(a) {
  if (!a) return null;
  const top = (a.contributors || []).slice(0, 3);
  const names = top.map(
    (c) =>
      `${c.label.toLowerCase()} ${c.direction === "above_baseline" ? "higher" : "lower"} than your usual`,
  );
  switch (a.application_state) {
    case "review_recommended":
      return `Relay's model finds an unusual pattern in your readings and your answers do not explain it${names.length ? `: ${names.join(", ")}` : ""}.`;
    case "context_needed":
      return `Relay's model finds an unusual pattern in your readings${names.length ? `: ${names.join(", ")}` : ""}. Your answers help explain it.`;
    case "insufficient_data":
      return `Relay's model does not have enough recent readings to judge${a.missing_signals?.length ? ` (missing: ${a.missing_signals.map((m) => m.metric.replace("_", " ")).join(", ")})` : ""}.`;
    default:
      return "Relay's model finds nothing unusual in your recent readings.";
  }
}

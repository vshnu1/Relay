// The ElevenLabs conversational agent for the patient view. Everything the agent
// needs to reason about this patient travels as dynamic variables and one client
// tool: the recent readings against the patient's usual, the model's latest result,
// and the condition's questions with their allowed answers. The agent hands back
// structured answers and one recommendation; this app decides what to show and the
// patient decides what to send. The agent never diagnoses; the prompt in
// docs/voice-agent.md forbids it and the tools give it nothing to diagnose with.
import { QUESTIONS } from "../model/profiles.js";
import { describeAnalysis } from "../model/mlClient.js";
import { checkinWhy } from "../model/schedule.js";

export async function voiceAvailable(fetchFn = fetch) {
  try {
    const res = await fetchFn("/api/status", { headers: authHeaders() });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body.voice;
  } catch {
    return false;
  }
}

function authHeaders() {
  const headers = { "content-type": "application/json" };
  try {
    const code = sessionStorage.getItem("rx-code");
    if (code) headers.authorization = `Bearer ${code}`;
  } catch {
    // no session storage
  }
  return headers;
}

// What the agent may know. Plain values only, no free text from the record.
export function recoveryStatus(p, questions) {
  const a = p.analysis;
  return {
    patient_first_name: p.first,
    program: p.profile.name,
    day_at_home: p.dayHome,
    window_days: p.windowDays,
    hospital: p.hospital,
    readings: p.counted.map((s) => ({
      name: s.plain,
      today: s.today === null ? null : `${s.fmt(s.today)} ${s.unit}`,
      usual: s.usual === null ? null : `${s.fmt(s.usual)} ${s.unit}`,
      change: s.today === null ? "no reading" : s.change,
      past_threshold: !!s.moved,
      days_away_from_usual: s.towardDays,
    })),
    model: a
      ? {
          state: a.application_state,
          anomaly_score: a.anomaly_score,
          data_quality: a.data_quality?.status,
          contributors: (a.contributors || []).slice(0, 4).map((c) => ({
            name: c.label,
            direction: c.direction === "above_baseline" ? "higher" : "lower",
            robust_deviation: c.robust_deviation,
          })),
          summary: describeAnalysis(a),
        }
      : {
          state: "not_scored",
          summary: "The model has not scored these readings yet.",
        },
    questions: questions.map((id) => ({
      id,
      text: QUESTIONS[id].text,
      options: QUESTIONS[id].options,
    })),
    last_answers: p.answered ? p.answered.answers : null,
  };
}

// Match what the agent says an answer was to one of the allowed options.
function pickOption(value, options) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (
    options.find((o) => o.toLowerCase() === v) ||
    options.find((o) => v.includes(o.toLowerCase())) ||
    null
  );
}

export async function startPatientVoiceSession({
  patient: p,
  questions,
  consent,
  onStatus,
  onAgentSaid,
  onAnswers,
  onRecommendation,
  onError,
  onDisconnect,
  fetchFn = fetch,
}) {
  const res = await fetchFn("/api/voice/session", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ consent, patientId: p.id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.signed_url)
    throw new Error(body.error || "Voice is not available right now.");
  const { Conversation } = await import("@elevenlabs/client");
  const status = recoveryStatus(p, questions);
  // The agent opens by saying why this check-in is happening: the cadence (daily
  // for the first week, every other day after) or the readings that moved.
  const why = checkinWhy(p);
  const firstMessage = `Hi ${p.first}. This is Relay, checking in on day ${p.dayHome} of your recovery after ${p.profile.after}. ${why} I have ${questions.length} short questions; we can just talk through them. Nothing I say is a diagnosis. Is it okay to start?`;
  return Conversation.startSession({
    signedUrl: body.signed_url,
    connectionType: "websocket",
    dynamicVariables: {
      patient_name: p.first,
      program: p.profile.name,
      day_at_home: String(p.dayHome),
      checkin_reason: why,
      model_state: status.model.state,
      model_summary: status.model.summary,
      readings_summary: status.readings
        .map(
          (r) =>
            `${r.name}: ${r.today ?? "no reading"} (usual ${r.usual ?? "unknown"}, ${r.change}${r.past_threshold ? ", past threshold" : ""})`,
        )
        .join("; "),
      question_list: status.questions
        .map((q) => `${q.id}: ${q.text} [${q.options.join(" / ")}]`)
        .join(" | "),
    },
    overrides: { agent: { firstMessage } },
    onConnect: () => onStatus?.("connected"),
    onDisconnect: () => onDisconnect?.(),
    onStatusChange: ({ status: st }) => onStatus?.(st),
    onMessage: (m) => {
      if (m?.source === "ai" && m?.message) onAgentSaid?.(m.message);
    },
    onError: (e) => onError?.(e),
    clientTools: {
      get_recovery_status: async () => JSON.stringify(status),
      record_checkin_response: async (params) => {
        const answers = {};
        const raw =
          params?.answers && typeof params.answers === "object"
            ? params.answers
            : params || {};
        for (const id of questions) {
          const picked = pickOption(raw[id], QUESTIONS[id].options);
          if (picked) answers[id] = picked;
        }
        const note =
          typeof params?.note === "string" &&
          params.note.trim().toLowerCase() !== "none"
            ? params.note.trim()
            : null;
        onAnswers?.(answers, note);
        const missing = questions.filter((id) => !answers[id]);
        return missing.length
          ? `Recorded ${Object.keys(answers).length} answers. Still needed: ${missing.map((id) => QUESTIONS[id].text).join(" ")}`
          : "All answers recorded. Tell the patient what the app will do next and say goodbye.";
      },
      recommend_action: async (params) => {
        const action = ["send_report", "message_care_team", "none"].includes(
          params?.action,
        )
          ? params.action
          : "none";
        onRecommendation?.({
          action,
          reason:
            typeof params?.reason === "string"
              ? params.reason.slice(0, 400)
              : "",
        });
        return `Recommendation noted: ${action}. The patient decides whether to send anything.`;
      },
    },
  });
}

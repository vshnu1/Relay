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
export function recoveryStatus(
  p,
  questions,
  { analysis = p.analysis, contextPrompt, checkinMode, focusSummary } = {},
) {
  const a = analysis;
  return {
    patient_first_name: p.first,
    program: p.profile.name,
    // The phrasing the rest of the app uses, so the agent opens the way every
    // other screen speaks: "recovering after a COPD flare-up", not "recovering
    // after COPD flare-up".
    recovering_after: p.profile.after,
    // What this condition deliberately does not count. Without it the agent
    // cannot answer "what about my sleep?" for a patient whose program
    // records sleep but does not watch it.
    recorded_not_counted: (p.others || []).map((s) => s.plain),
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
          summary: describeAnalysis(a, p.profile),
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
    checkin_mode: checkinMode || "routine",
    priority_summary: focusSummary || "",
    context_prompt:
      contextPrompt ||
      "Ask whether the patient has any other context to share.",
  };
}

// Match what the agent says an answer was to one of the allowed options.
function pickOption(value, options) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  const direct =
    options.find((o) => o.toLowerCase() === v) ||
    options.find((o) => v.includes(o.toLowerCase())) ||
    null;
  if (direct) return direct;
  if (
    options.includes("A lot") &&
    /\b(much|a lot|very|severe|significantly|far more)\b/.test(v)
  )
    return "A lot";
  if (
    options.includes("A little") &&
    /\b(a little|slightly|a bit|somewhat|mildly)\b/.test(v)
  )
    return "A little";
  if (
    options.includes("Not sure") &&
    /\b(not sure|unsure|don't know|do not know|uncertain|maybe)\b/.test(v)
  )
    return "Not sure";
  if (
    options.includes("Yes") &&
    /\b(yes|yeah|yep|i did|i have|i am|i was)\b/.test(v)
  )
    return "Yes";
  if (
    options.includes("No") &&
    /\b(no|nope|not really|unchanged|the same|haven't|have not|didn't|did not)\b/.test(
      v,
    )
  )
    return "No";
  return null;
}

export function openingMessage(
  patient,
  questions,
  priority,
  mode,
  findingSummary,
) {
  const first = QUESTIONS[questions[0]];
  const introduction = priority
    ? `I noticed some readings have been different from your usual: ${findingSummary || "a few wearable readings have changed"}. I cannot tell what caused that.`
    : mode === "insufficient"
      ? "There are not enough recent readings to compare yet, so I will ask about how you are doing."
      : `I am checking in about your recovery after ${patient.profile.after}.`;
  return `Hi ${patient.first}, this is Relay. ${introduction} I have ${questions.length} brief questions, then one optional question about anything else that may help your care team understand what you have been doing and how you feel. You can answer in your own words or stop at any time. First: ${first.text}`;
}

export async function startPatientVoiceSession({
  patient: p,
  analysis,
  questions,
  contextPrompt,
  checkinMode,
  priority,
  findingSummary,
  consent,
  onStatus,
  onAgentSaid,
  onAnswers,
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
  const status = recoveryStatus(p, questions, {
    analysis,
    contextPrompt,
    checkinMode,
    focusSummary: findingSummary,
  });
  const why = checkinWhy({ ...p, analysis });
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
        .map((q) => `${q.id}: ${q.text}`)
        .join(" | "),
      checkin_mode: status.checkin_mode,
      priority_checkin: priority ? "yes" : "no",
      priority_summary: status.priority_summary,
      context_prompt: status.context_prompt,
      question_count: String(questions.length),
      opening_message: openingMessage(
        p,
        questions,
        priority,
        checkinMode,
        findingSummary,
      ),
    },
    onConnect: () => onStatus?.("connected"),
    onDisconnect: (details) => onDisconnect?.(details),
    onStatusChange: ({ status: st }) => onStatus?.(st),
    onMessage: (m) => {
      if (m?.source === "ai" && m?.message) onAgentSaid?.(m.message);
    },
    onError: (e) => onError?.(e),
    clientTools: {
      record_checkin_response: async (params) => {
        const answers = {};
        const rawObject =
          params?.answers && typeof params.answers === "object"
            ? params.answers
            : null;
        // ElevenLabs client tools accept flat, fixed parameters. Map those
        // ordered slots back to this session's dynamic question ids.
        const raw =
          rawObject ||
          Object.fromEntries(
            questions.map((id, index) => [id, params?.[`answer_${index + 1}`]]),
          );
        for (const id of questions) {
          const picked = pickOption(raw[id], QUESTIONS[id].options);
          if (picked) answers[id] = picked;
        }
        const note =
          typeof params?.note === "string" &&
          params.note.trim().toLowerCase() !== "none"
            ? params.note.trim().slice(0, 500)
            : null;
        onAnswers?.(answers, note);
        const missing = questions.filter((id) => !answers[id]);
        return missing.length
          ? `Recorded ${Object.keys(answers).length} answers. Still needed: ${missing.map((id) => QUESTIONS[id].text).join(" ")}`
          : "All answers recorded. Tell the patient what the app will do next and say goodbye.";
      },
    },
  });
}

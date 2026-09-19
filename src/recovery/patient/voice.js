// The ElevenLabs conversational agent for the patient view. Everything the agent
// needs to reason about this patient travels as dynamic variables and one client
// tool: the recent readings against the patient's usual, the model's latest result,
// and the condition's questions with their allowed answers. The agent hands back
// structured answers and one recommendation; this app decides what to show and the
// patient decides what to send. The agent never diagnoses; the prompt in
// docs/voice-agent.md forbids it and the tools give it nothing to diagnose with.
import { authHeaders } from "../model/authHeaders.js";
import { QUESTIONS } from "../model/profiles.js";
import { describeAnalysis } from "../model/mlClient.js";
import { checkinWhy } from "../model/schedule.js";
import { matchQuestionOption } from "./answerText.js";

export async function voiceStatus(fetchFn = fetch) {
  try {
    const res = await fetchFn("/api/status", { headers: authHeaders() });
    if (!res.ok)
      return {
        available: false,
        reason: `Relay’s server is not responding right now (${res.status}). Try text or retry voice in a moment.`,
      };
    const body = await res.json();
    return body.voice
      ? { available: true, reason: "" }
      : {
          available: false,
          reason:
            "ElevenLabs is not configured on this server. You can still finish this check-in by text.",
        };
  } catch {
    return {
      available: false,
      reason:
        "Relay’s server could not be reached. You can still check in by text.",
    };
  }
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
    day_at_home: p.dayHome + 1,
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

// Use the same cautious, whole-phrase answer mapping as the text check-in.
const pickOption = (questionId, value) =>
  matchQuestionOption(questionId, value);

// Adapt the next spoken turn to the current discharge-specific question and
// the patient's answer. One brief follow-up for the whole check-in is enough to
// clarify a change; the agent otherwise acknowledges and moves on.
export function adaptiveTurnGuidance(
  questionId,
  utterance,
  followUpUsed = false,
) {
  const question = QUESTIONS[questionId];
  if (!question)
    return {
      message: "Continue briefly with the next selected question.",
      asksFollowUp: false,
    };
  const answer = matchQuestionOption(questionId, utterance);
  const unchanged = ["No", "Same", "Usual"].includes(answer);
  if (followUpUsed) {
    return {
      message: `The patient has used the one clarification. Their answer is ${answer || "unclear"} for “${question.short}.” Do not ask another follow-up. If clear, record it; otherwise use “Not sure” if available. Acknowledge in a few words and continue.`,
      asksFollowUp: false,
    };
  }
  if (unchanged) {
    return {
      message: `The patient answered “${question.short}” with ${answer}. Do not probe. Acknowledge in a few words and ask the next selected question. Keep it brief.`,
      asksFollowUp: false,
    };
  }
  const followUp = {
    mealPlan: "What did you eat or drink, and which instruction differed?",
    medicine: "Which medicine changed, and when?",
    activity: "What activity, and when?",
  }[questionId] || "When did it start, or how often?";
  if (!answer) {
    const clarification = {
      mealPlan: "Was it outside your discharge instructions?",
      medicine: "Which medicine changed, if any?",
      activity: "Was that more activity than your plan?",
    }[questionId] || `Could you say more about ${question.short.toLowerCase()}?`;
    return {
      message: `The answer about “${question.short}” is unclear. Ask only: “${clarification}” Do not suggest an answer. Keep the acknowledgment under 8 words, then continue.`,
      asksFollowUp: true,
    };
  }
  return {
    message: `The patient reports ${answer} for “${question.short}.” Acknowledge in a few words, then ask only: “${followUp}” Keep it brief; do not infer a cause.`,
    asksFollowUp: true,
  };
}

export function openingMessage(
  patient,
  questions,
  priority,
  mode,
  findingSummary,
) {
  const first = QUESTIONS[questions[0]];
  if (!first)
    return `Hi ${patient.first}, this is Relay checking in. How have you been feeling today?`;

  if (priority) {
    // Start with the top-ranked finding only. The model and readings remain
    // available to the agent if the patient asks, but the greeting should not
    // become a spoken report before the first question.
    const leadFinding = findingSummary?.split(",")[0]?.trim();
    const match = leadFinding?.match(/^(.+?) (higher|lower) than your usual/);
    const context = match
      ? `I noticed your ${match[1]} is ${match[2]} than usual.`
      : "I noticed a change in your readings.";
    return `Hi ${patient.first}, this is Relay. ${context} ${first.text}`;
  }

  if (mode === "insufficient")
    return `Hi ${patient.first}, I do not have enough readings to compare yet. ${first.text}`;

  return `Hi ${patient.first}, how has your recovery been? ${first.text}`;
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
  onPatientSaid,
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
  const [
    { Conversation },
    { default: rawAudioProcessorUrl },
    { default: audioConcatProcessorUrl },
  ] = await Promise.all([
    import("@elevenlabs/client"),
    import("@elevenlabs/client/worklets/rawAudioProcessor.js?url&no-inline"),
    import("@elevenlabs/client/worklets/audioConcatProcessor.js?url&no-inline"),
  ]);
  const status = recoveryStatus(p, questions, {
    analysis,
    contextPrompt,
    checkinMode,
    focusSummary: findingSummary,
  });
  const why = checkinWhy({ ...p, analysis });
  let activeSession = null;
  activeSession = await Conversation.startSession({
    signedUrl: body.signed_url,
    connectionType: "websocket",
    // Render's strict CSP blocks generated blob/data worklet modules. Serve
    // both microphone and playback processors as same-origin build assets.
    workletPaths: {
      rawAudioProcessor: rawAudioProcessorUrl,
      audioConcatProcessor: audioConcatProcessorUrl,
    },
    dynamicVariables: {
      patient_name: p.first,
      program: p.profile.name,
      day_at_home: String(p.dayHome + 1),
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
      if (!m?.message) return;
      if (m.source === "ai") onAgentSaid?.(m.message);
      else if (m.source === "user")
        onPatientSaid?.(m.message, (context) =>
          activeSession?.sendContextualUpdate?.(context),
        );
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
          const picked = pickOption(id, raw[id]);
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
  return activeSession;
}

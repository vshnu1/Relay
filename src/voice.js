import { api } from "./api.js";

const ANSWER_KEYS = ["exercise", "fatigue", "medication", "notes"];

function draftAnswers(parameters) {
  if (!parameters || typeof parameters !== "object") return {};
  return Object.fromEntries(
    ANSWER_KEYS.flatMap((key) => {
      const value = parameters[key];
      return typeof value === "string" &&
        value.trim() &&
        !(key === "notes" && value.trim().toLowerCase() === "none")
        ? [[key, value.trim()]]
        : [];
    }),
  );
}

// Everything ElevenLabs-specific lives here, so voice work never touches UI files.
// Resolves to the live session; the caller owns ending it.
export async function startVoiceSession({
  patient,
  consent,
  onStatus,
  onError,
  onAnswers,
  onConversationCreated,
  onDisconnect,
}) {
  const result = await api(`/patients/${patient.id}/voice`, {
    consent,
  });
  if (!result?.signed_url)
    throw new Error("ElevenLabs did not return a signed session URL.");
  const { Conversation } = await import("@elevenlabs/client");
  const flagged = (patient?.evidence?.signals || []).filter(
    (signal) => signal.flagged,
  );
  const signalSummary = flagged.length
    ? flagged.map((signal) => signal.label.toLowerCase()).join(", ")
    : "recent measurements";
  const firstMessage = `Hi ${patient?.name || "there"}. Relay noticed a statistical change in ${signalSummary}. This is not a diagnosis or an emergency assessment. With your consent, I will ask four brief context questions for your care team.`;
  return Conversation.startSession({
    signedUrl: result.signed_url,
    connectionType: "websocket",
    dynamicVariables: {
      patient_name: patient?.name || "the patient",
      evidence_state: patient?.evidence?.state || "quiet",
      flagged_signals: signalSummary,
    },
    overrides: {
      agent: {
        firstMessage,
      },
    },
    onConnect: onConversationCreated,
    onDisconnect,
    onStatusChange: ({ status }) => onStatus(status),
    onError,
    clientTools: {
      record_checkin_response: async (parameters) => {
        const answers = draftAnswers(parameters);
        if (Object.keys(answers).length) onAnswers(answers);
        return "Answers drafted. Ask the patient to verify and submit the form.";
      },
    },
  });
}

import { api } from "./api.js";

const ANSWER_KEYS = ["exercise", "fatigue", "medication"];

// Everything ElevenLabs-specific lives here, so voice work never touches UI files.
// Resolves to the live session; the caller owns ending it.
export async function startVoiceSession({
  patient,
  consent,
  onStatus,
  onError,
  onAnswers,
}) {
  const { signed_url } = await api(`/patients/${patient.id}/voice`, {
    consent,
  });
  const { Conversation } = await import("@elevenlabs/client");
  const flagged = (patient?.evidence?.signals || []).filter(
    (signal) => signal.flagged,
  );
  const signalSummary = flagged.length
    ? flagged.map((signal) => signal.label.toLowerCase()).join(", ")
    : "recent measurements";
  const firstMessage = `Hi ${patient?.name || "there"}. Relay noticed a statistical change in ${signalSummary}. This is not a diagnosis or an emergency assessment. With your consent, I will ask three brief context questions for your care team.`;
  return Conversation.startSession({
    signedUrl: signed_url,
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
    onStatusChange: ({ status }) => onStatus(status),
    onError,
    clientTools: {
      record_checkin_response: async (parameters) => {
        onAnswers(
          Object.fromEntries(
            Object.entries(parameters).filter(([k]) => ANSWER_KEYS.includes(k)),
          ),
        );
        return "Answers drafted. Ask the patient to verify and submit the form.";
      },
    },
  });
}

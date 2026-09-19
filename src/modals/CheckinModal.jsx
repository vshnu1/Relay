import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines } from "lucide-react";
import { startVoiceSession } from "../voice.js";
export default function CheckinModal({
  patient,
  status,
  busy,
  run,
  setError,
  onSubmit,
}) {
  const [consent, setConsent] = useState(false),
    [answers, setAnswers] = useState({
      exercise: "",
      fatigue: "",
      medication: "",
      notes: "",
    }),
    [voice, setVoice] = useState(null),
    [voiceStatus, setVoiceStatus] = useState(""),
    [conversationId, setConversationId] = useState(""),
    [checkinMethod, setCheckinMethod] = useState(
      "Patient-confirmed structured form",
    );
  const voiceRef = useRef(null);
  // Closing the dialog by any route unmounts it, which ends a live session.
  useEffect(() => () => voiceRef.current?.endSession(), []);
  async function startVoice() {
    setVoiceStatus("connecting");
    try {
      voiceRef.current = await startVoiceSession({
        patient,
        consent,
        onStatus: setVoiceStatus,
        onError: () => {
          setVoice(false);
          setVoiceStatus("disconnected");
          setError(
            "Voice session interrupted. Complete the structured text check-in below.",
          );
        },
        onConversationCreated: ({ conversationId: id }) => {
          setConversationId(id || "");
          setCheckinMethod("ElevenLabs voice assistant");
        },
        onDisconnect: () => {
          setVoice(false);
          setVoiceStatus("disconnected");
          voiceRef.current = null;
        },
        onAnswers: (draft) => {
          setAnswers((a) => ({ ...a, ...draft }));
          setCheckinMethod("ElevenLabs voice assistant");
        },
      });
    } catch (error) {
      setVoiceStatus("disconnected");
      throw error;
    }
    setVoice(true);
  }
  const canStartVoice =
    consent &&
    patient?.consent &&
    !busy &&
    status?.voice &&
    patient?.dataType === "synthetic";
  return (
    <>
      <div className="modal-symbol">
        <AudioLines />
      </div>
      <div className="eyebrow">PATIENT CHECK-IN</div>
      <h2>A little context goes a long way.</h2>
      <p>
        Your care team's monitoring program noticed a change in recent
        measurements. This is not a diagnosis or emergency assessment.
      </p>
      <label className="consent-box">
        <input
          type="checkbox"
          checked={consent}
          disabled={!patient?.consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I consent to this check-in and sharing my answers with the demo care
        team.
      </label>
      {!patient?.consent && (
        <p className="fine-print">
          Monitoring consent is currently revoked. Restore consent before
          starting a patient check-in.
        </p>
      )}
      <button
        className="button secondary full"
        disabled={!voice ? !canStartVoice : busy}
        onClick={() =>
          run(
            voice
              ? async () => {
                  await voiceRef.current?.endSession();
                  voiceRef.current = null;
                  setVoice(null);
                }
              : startVoice,
          )
        }
      >
        <AudioLines size={17} />
        {voice
          ? `End voice session · ${voiceStatus}`
          : status?.voice
            ? "Start ElevenLabs voice check-in"
            : "Voice not configured · use text below"}
      </button>
      {voice && (
        <p className="fine-print" role="status">
          Voice session {voiceStatus || "connecting"}. Speak naturally; the
          assistant will draft answers for your review.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...answers,
            consent,
            method: checkinMethod,
            conversationId,
          });
        }}
      >
        {[
          [
            "exercise",
            "Any recent exercise or unusual activity?",
            ["No unusual activity", "Recent exercise", "Unsure"],
          ],
          [
            "fatigue",
            "How has your fatigue changed?",
            ["None", "Unchanged", "Worsening", "Unsure"],
          ],
          [
            "medication",
            "Any missed or changed medications?",
            ["No changes", "Missed or changed", "Unsure"],
          ],
        ].map(([key, question, options]) => (
          <label className="form-field" key={key}>
            {question}
            <select
              required
              value={answers[key]}
              onChange={(e) =>
                setAnswers({ ...answers, [key]: e.target.value })
              }
            >
              <option value="">Choose an answer</option>
              {options.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="form-field">
          Anything else that may explain the change? (Optional)
          <textarea
            value={answers.notes}
            maxLength={500}
            rows={3}
            placeholder="For example: meal, soda, strenuous activity, or symptoms you want your care team to know about."
            onChange={(e) => setAnswers({ ...answers, notes: e.target.value })}
          />
        </label>
        <p className="fine-print">
          For urgent symptoms, follow your existing emergency instructions.
          Verify the answers above before submitting, including any drafted
          during a voice session.
        </p>
        <button
          className="button primary full"
          disabled={!consent || !patient?.consent || busy}
        >
          Save check-in & update summary <ArrowRight size={15} />
        </button>
      </form>
    </>
  );
}

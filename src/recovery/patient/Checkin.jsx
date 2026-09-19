import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  HeartPulse,
  MessageCircle,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { actions, useSyncStatus } from "../useRecovery.js";
import { QUESTIONS, SIGNALS } from "../model/profiles.js";
import { checkinDue, checkinTriggerKey } from "../model/schedule.js";
import { useAnalysis } from "./useAnalysis.js";
import {
  adaptiveTurnGuidance,
  startPatientVoiceSession,
  voiceStatus,
} from "./voice.js";
import { buildCheckinPlan } from "./checkinPlan.js";
import { matchOption } from "./answerText.js";

// The check-in is one conversation. Relay opens by saying why it is checking in
// (daily for the first week home, every other day after, or because the readings
// moved), then talks through the profile's questions. Voice check-ins use the
// ElevenLabs agent; if voice is unavailable, the patient can continue by text.

const STATUS = {
  "": "Not started",
  connecting: "Connecting…",
  connected: "Listening",
  ended: "Call ended",
  review: "Review your answers",
};

export default function Checkin({ patient: p }) {
  const [checkinPlan, setCheckinPlan] = useState(() => buildCheckinPlan(p));
  const questions = checkinPlan.questions;
  const due = checkinDue(p);
  const { run: score } = useAnalysis(p);
  const [phase, setPhase] = useState("idle"); // idle | live | review | sending | done
  const [engine, setEngine] = useState(null); // elevenlabs | text
  const [inputMode, setInputMode] = useState("text"); // text | voice
  const [textAnswer, setTextAnswer] = useState("");
  const [log, setLog] = useState([]);
  const [answers, setAnswers] = useState({});
  const [textAnswers, setTextAnswers] = useState({});
  const [stage, setStage] = useState({ kind: "question", i: 0 });
  const [voice, setVoice] = useState({
    available: false,
    status: "",
    error: "",
    unavailableReason: "",
  });
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [shareConsent, setShareConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [modelUsed, setModelUsed] = useState(false);
  const [scoreAttempted, setScoreAttempted] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const syncStatus = useSyncStatus();
  const sessionRef = useRef(null);
  const endRef = useRef(null);
  const answersRef = useRef({});
  const completedDraftRef = useRef(null);
  const endingByPatientRef = useRef(false);
  const voiceTranscriptRef = useRef([]);
  const voiceQuestionIndexRef = useRef(0);
  const voiceFollowUpUsedRef = useRef(false);
  const voiceAwaitingFollowUpRef = useRef(false);

  const noteWithVoiceTranscript = (note) => {
    const transcript = voiceTranscriptRef.current
      .map((line) => line.trim())
      .filter(Boolean);
    if (!transcript.length) return (note || "").slice(0, 2000);
    const spoken = `Patient’s spoken answers: ${transcript.join(" / ")}`;
    return [note?.trim(), spoken].filter(Boolean).join("\n\n").slice(0, 2000);
  };

  useEffect(() => {
    let live = true;
    voiceStatus().then(
      (result) =>
        live &&
        setVoice((v) => ({
          ...v,
          available: result.available,
          unavailableReason: result.reason,
        })),
    );
    return () => {
      live = false;
      sessionRef.current?.endSession?.();
    };
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  const say = (who, text) => setLog((l) => [...l, { who, text }]);

  const finish = (all, note, freeTextAnswers = {}) => {
    if (sessionRef.current) endingByPatientRef.current = true;
    sessionRef.current?.endSession?.();
    sessionRef.current = null;
    completedDraftRef.current = null;
    setReviewDraft({
      answers: all,
      textAnswers: freeTextAnswers,
      transcriptNote: (note || "").slice(0, 2000),
      note: "",
    });
    setShareConsent(false);
    setPhase("review");
    setVoice((v) => ({ ...v, status: "review" }));
  };

  // ---- ElevenLabs path -------------------------------------------------------
  const startAgent = async (plan) => {
    if (!voiceConsent) return;
    voiceTranscriptRef.current = [];
    voiceQuestionIndexRef.current = 0;
    voiceFollowUpUsedRef.current = false;
    voiceAwaitingFollowUpRef.current = false;
    completedDraftRef.current = null;
    endingByPatientRef.current = false;
    setEngine("elevenlabs");
    setPhase("live");
    setVoice((v) => ({ ...v, status: "connecting", error: "" }));
    try {
      sessionRef.current = await startPatientVoiceSession({
        patient: p,
        analysis: plan.analysis,
        questions: plan.questions,
        contextPrompt: plan.contextPrompt,
        checkinMode: plan.mode,
        priority: plan.priority,
        findingSummary: plan.findingSummary,
        consent: voiceConsent,
        onStatus: (st) => setVoice((v) => ({ ...v, status: st })),
        onAgentSaid: (text) => say("relay", text),
        onPatientSaid: (text, sendContextualUpdate) => {
          voiceTranscriptRef.current.push(text);
          say("you", text);
          const questionId = plan.questions[voiceQuestionIndexRef.current];
          if (!questionId) {
            sendContextualUpdate?.(
              "The selected check-in questions are complete. Invite the patient to add optional context in their own words, or say no. Do not ask another symptom question or probe for a cause.",
            );
            return;
          }
          const wasFollowUp = voiceAwaitingFollowUpRef.current;
          const guidance = adaptiveTurnGuidance(
            questionId,
            text,
            voiceFollowUpUsedRef.current,
          );
          sendContextualUpdate?.(guidance.message);
          if (wasFollowUp) {
            voiceAwaitingFollowUpRef.current = false;
            voiceQuestionIndexRef.current += 1;
          } else if (guidance.asksFollowUp) {
            voiceFollowUpUsedRef.current = true;
            voiceAwaitingFollowUpRef.current = true;
          } else {
            voiceQuestionIndexRef.current += 1;
          }
        },
        onAnswers: (a, note) => {
          const merged = { ...answersRef.current, ...a };
          answersRef.current = merged;
          setAnswers(merged);
          if (plan.questions.every((q) => merged[q]))
            completedDraftRef.current = { answers: merged, note };
        },
        onError: (e) =>
          setVoice((v) => ({ ...v, error: e?.message || String(e) })),
        onDisconnect: (details) => {
          sessionRef.current = null;
          setVoice((v) => ({ ...v, status: "ended" }));
          if (endingByPatientRef.current) {
            endingByPatientRef.current = false;
            return;
          }
          const draft = completedDraftRef.current;
          if (draft && plan.questions.every((q) => draft.answers[q])) {
            finish(draft.answers, noteWithVoiceTranscript(draft.note));
            return;
          }
          setPhase("interrupted");
          setVoice((v) => ({
            ...v,
            status: "ended",
            error:
              v.error ||
              (details?.reason === "error"
                ? `Voice connection ended: ${details.message}`
                : "The voice call ended before the check-in was complete. Nothing has been shared. Continue by typing."),
          }));
        },
      });
    } catch (e) {
      setVoice((v) => ({ ...v, status: "", error: e.message || String(e) }));
      setPhase("idle");
      setEngine(null);
    }
  };

  const startCheckin = async () => {
    if (inputMode === "voice") {
      const status = await voiceStatus();
      setVoice((v) => ({
        ...v,
        available: status.available,
        unavailableReason: status.reason,
        error: status.available ? "" : status.reason,
      }));
      if (!status.available || !voiceConsent) return;
    }
    answersRef.current = {};
    setAnswers({});
    setTextAnswers({});
    setLog([]);
    setNoteDraft("");
    setTextAnswer("");
    setPreparing(true);
    // The model is tried first so its contributor signals can prioritize the
    // questions. If the server has no model configured, the profile's wearable
    // thresholds and discharge-specific question order remain the safe fallback.
    const freshAnalysis = await score();
    // Only use a fresh result from this session to claim the model informed
    // these questions. A previous score can be stale; rule-based wearable
    // changes remain a transparent fallback if the scorer is unavailable.
    const analysis = freshAnalysis || null;
    setScoreAttempted(true);
    setModelUsed(!!analysis);
    const nextPlan = buildCheckinPlan(p, analysis);
    nextPlan.analysis = analysis;
    nextPlan.modelUnavailable = !analysis;
    setCheckinPlan(nextPlan);
    setPreparing(false);
    if (inputMode === "text") startText(nextPlan);
    else await startAgent(nextPlan);
  };

  const startText = (plan) => {
    answersRef.current = {};
    setAnswers({});
    setTextAnswers({});
    setLog([]);
    setNoteDraft("");
    setStage({ kind: "question", i: 0 });
    setTextAnswer("");
    setEngine("text");
    setPhase("live");
    setVoice((v) => ({ ...v, status: "connected", error: "" }));
    say(
      "relay",
      `Hi ${p.first}, this is Relay. ${plan.priority ? "Let’s check what has changed." : "How has your recovery been?"} ${QUESTIONS[plan.questions[0]].text}`,
    );
  };

  const advanceText = (answer, plan = checkinPlan) => {
    const i = stage.i;
    if (stage.kind !== "question" || i >= plan.questions.length) return;
    const qid = plan.questions[i];
    const text = answer.trim().slice(0, 500);
    if (!text) return;
    const picked = matchOption(text, QUESTIONS[qid].options);
    const freeAnswers = { ...textAnswers, [qid]: text };
    setTextAnswers(freeAnswers);
    const next = {
      ...answersRef.current,
      ...(picked ? { [qid]: picked } : {}),
    };
    answersRef.current = next;
    setAnswers(next);
    setNoteDraft((previous) =>
      `${previous}${previous ? "\n" : ""}${QUESTIONS[qid].short}: ${text}`.slice(
        0,
        2000,
      ),
    );
    say("you", text);
    setTextAnswer("");
    if (i + 1 < plan.questions.length) {
      setStage({ kind: "question", i: i + 1 });
      say("relay", `Thank you. ${QUESTIONS[plan.questions[i + 1]].text}`);
    } else {
      setStage({ kind: "note" });
      say(
        "relay",
        `${plan.contextPrompt} You can add anything else, or finish now.`,
      );
    }
  };

  const finishText = (skipExtra = false) => {
    const extra = skipExtra ? "" : textAnswer.trim();
    if (extra) {
      setNoteDraft((previous) =>
        `${previous}${previous ? "\n" : ""}Additional context: ${extra}`.slice(
          0,
          2000,
        ),
      );
      say("you", extra);
    }
    say(
      "relay",
      "Thanks. Review your answers and choose whether to share them with your care team.",
    );
    finish(
      answersRef.current,
      `${noteDraft}${noteDraft && extra ? "\n" : ""}${extra ? `Additional context: ${extra}` : ""}`,
      textAnswers,
    );
    setTextAnswer("");
  };

  const stop = () => {
    endingByPatientRef.current = true;
    sessionRef.current?.endSession?.();
    sessionRef.current = null;
    setVoice((v) => ({ ...v, status: "ended" }));
    if (phase !== "done") setPhase("idle");
  };

  const nextMissing = questions.find((q) => !answers[q]) || null;
  const current =
    (phase === "live" || phase === "interrupted") &&
    (engine === "text" ? stage.kind === "question" : nextMissing) &&
    stage.kind !== "note"
      ? QUESTIONS[
          engine === "text" ? checkinPlan.questions[stage.i] : nextMissing
        ]
      : null;
  const status =
    engine === "text" && phase === "live"
      ? "Text conversation"
      : (STATUS[voice.status] ?? voice.status);
  const focusRows = (p.counted || [])
    .filter((signal) => checkinPlan.focusSignals.includes(signal.id))
    .filter((signal) => signal.moved)
    .slice(0, 3);
  const visibleSignals = focusRows.length
    ? focusRows.map((signal) => ({
        label: signal.plain || SIGNALS[signal.id]?.plain || signal.id,
        direction: signal.watchDir > 0 ? "Higher" : "Lower",
        duration: signal.towardDays
          ? `${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
          : "Recent",
      }))
    : (checkinPlan.analysis?.contributors || []).slice(0, 3).map((item) => ({
        label: item.label || item.metric || "Wearable reading",
        direction: item.direction === "above_baseline" ? "Higher" : "Lower",
        duration: "Recent",
      }));
  const submitVoiceDraft = async () => {
    if (!reviewDraft || !shareConsent) return;
    const complete = questions.every(
      (q) =>
        reviewDraft.answers[q] ||
        (engine === "text" && reviewDraft.textAnswers?.[q]),
    );
    if (!complete) return;
    setPhase("sending");
    const deliveries = [
      actions.submitCheckin(p.id, reviewDraft.answers, {
        kind: checkinPlan.priority ? "priority" : "routine",
        triggerKey: checkinPlan.priority
          ? checkinTriggerKey({
              ...p,
              analysis: checkinPlan.analysis,
            })
          : null,
      }),
    ];
    const noteToShare = [reviewDraft.transcriptNote, reviewDraft.note.trim()]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 3000);
    if (noteToShare) deliveries.push(actions.sendNote(p.id, noteToShare));
    const results = await Promise.all(deliveries);
    if (results.every((result) => result?.delivered)) {
      // Re-score only after the check-in has actually reached the shared log;
      // include the confirmed answers so the clinician evidence is contextual.
      await score(reviewDraft.answers);
      setAnswers(reviewDraft.answers);
      answersRef.current = reviewDraft.answers;
      setReviewDraft(null);
      setPhase("done");
    } else {
      setPhase("review");
      setVoice((v) => ({
        ...v,
        error:
          "This check-in could not be delivered. Check your connection and try again.",
      }));
    }
  };

  return (
    <>
      <a className="rx-p-back" href="#/patient">
        <ChevronLeft size={18} /> Home
      </a>
      <header className="rx-p-top">
        <div>
          <span className="rx-p-kicker">
            {due.reason === "asked"
              ? "Your care team asked"
              : due.reason === "readings"
                ? "Priority check-in"
                : `Day ${p.dayHome + 1} check-in`}
          </span>
          <h1 className="rx-p-title">Talk to Relay</h1>
          <p className="rx-p-lead">
            {checkinPlan.priority
              ? "A few readings have changed from your usual. We’ll talk through how you’re feeling and what was happening around then."
              : "A brief check-in about how recovery is going, how you feel, and what you have been doing today."}
          </p>
        </div>
      </header>

      <div className="rx-p-checkin-layout">
        <main className="rx-p-checkin-main">
          <section
            className="rx-p-card rx-p-callcard"
            aria-label="Check-in call"
          >
            <div className="rx-p-callrow">
              <span className={`rx-p-pill ${phase}`}>
                {phase === "done" ? "Sent" : status}
              </span>
              <span className="rx-p-fine">
                {questions.length} questions
                {checkinPlan.priority
                  ? ", about two minutes"
                  : ", about one minute"}
                .{" "}
                {inputMode === "text"
                  ? "Type freely in the conversation."
                  : "Speak naturally. Your words appear here as text."}
              </span>
            </div>
            {phase === "idle" && (
              <div className="rx-p-stack">
                <div className="rx-p-voice-welcome">
                  <span className="rx-p-voice-orb" aria-hidden="true">
                    <MessageCircle size={22} />
                  </span>
                  <div>
                    <strong>
                      {checkinPlan.priority
                        ? "Let’s check in on the change"
                        : "How has today been?"}
                    </strong>
                    <p>
                      {questions[0]
                        ? QUESTIONS[questions[0]].text
                        : "How are you feeling today?"}
                    </p>
                    <small>
                      Your answers stay private until you review and choose to
                      share them.
                    </small>
                  </div>
                </div>
                <fieldset className="rx-p-mode-choice">
                  <legend>Choose how you want to answer</legend>
                  <label className={inputMode === "text" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="checkin-mode"
                      value="text"
                      checked={inputMode === "text"}
                      onChange={() => setInputMode("text")}
                    />
                    <span>
                      <strong>Text conversation</strong>
                      <small>
                        Type answers in your own words. No microphone needed.
                      </small>
                    </span>
                  </label>
                  <label className={inputMode === "voice" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="checkin-mode"
                      value="voice"
                      checked={inputMode === "voice"}
                      onChange={() => setInputMode("voice")}
                    />
                    <span>
                      <strong>Voice conversation</strong>
                      <small>
                        Speak your answers and read the live transcript.
                      </small>
                    </span>
                  </label>
                </fieldset>
                {inputMode === "voice" && voice.available && (
                  <label className="rx-p-voice-consent">
                    <input
                      type="checkbox"
                      checked={voiceConsent}
                      onChange={(e) => setVoiceConsent(e.target.checked)}
                    />
                    <span>
                      I agree to send relevant readings and the model summary,
                      plus microphone audio during the call, to ElevenLabs for
                      this demo. My answers stay here for review and go to my
                      care team only if I submit them.
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  className="rx-p-btn primary"
                  disabled={
                    preparing ||
                    (inputMode === "voice" && voice.available && !voiceConsent)
                  }
                  onClick={startCheckin}
                >
                  {inputMode === "voice" ? (
                    <PhoneCall size={18} aria-hidden="true" />
                  ) : (
                    <MessageCircle size={18} aria-hidden="true" />
                  )}{" "}
                  {preparing
                    ? "Preparing check-in…"
                    : `Start ${checkinPlan.priority ? "priority" : "daily"} ${inputMode === "text" ? "text" : "voice"} check-in`}
                </button>
                {(modelUsed ||
                  scoreAttempted ||
                  checkinPlan.mode === "insufficient") && (
                  <small className="rx-p-fine">
                    {modelUsed
                      ? checkinPlan.analysis?.execution?.mode ===
                          "Render Workflows" &&
                        !checkinPlan.analysis?.execution?.modelFallback
                        ? "Questions are focused using this check-in’s Render Workflow analysis and your discharge plan."
                        : checkinPlan.analysis?.execution?.modelFallback
                          ? "Workflow completed with its rules evidence because the Python model was unavailable. Questions follow that evidence and your discharge plan."
                          : checkinPlan.analysis?.execution?.fallback
                            ? "Workflow scoring is unavailable. Questions use the clearly labelled fallback analysis and your discharge plan."
                            : "Questions are focused using the latest analysis and your discharge plan."
                      : scoreAttempted
                        ? "The scorer could not be reached, so questions use your discharge plan and recent reading changes."
                        : "There are not enough recent readings to compare yet. We’ll focus on how you feel and your discharge plan."}
                  </small>
                )}
                {inputMode === "voice" && !voice.available && (
                  <small className="rx-p-fine">
                    {voice.unavailableReason ||
                      "Relay voice is unavailable. Switch to text or try again."}{" "}
                    Voice check-ins won’t silently switch to another voice.
                  </small>
                )}
              </div>
            )}
            {phase === "live" && (
              <div className="rx-p-live-controls">
                <span className="rx-p-live-indicator">
                  <span /> {status}
                </span>
                {current && (
                  <span className="rx-p-live-question">{current.text}</span>
                )}
                <button type="button" className="rx-p-btn" onClick={stop}>
                  <PhoneOff size={18} aria-hidden="true" /> End check-in
                </button>
              </div>
            )}
            {phase === "interrupted" && (
              <p className="rx-p-error" role="status">
                The call ended early. Your answers are still here. Continue by
                typing, then review before sharing.
              </p>
            )}
            {voice.error && (
              <p className="rx-p-error" role="alert">
                {voice.error}
              </p>
            )}
          </section>

          {log.length > 0 && phase !== "idle" && (
            <div
              className="rx-p-chat rx-p-transcript"
              role="log"
              aria-live="polite"
              aria-label="Check-in conversation"
            >
              <span className="rx-p-chat-label">Conversation</span>
              {log.map((m, i) => (
                <div key={i} className={`rx-p-bubble ${m.who}`}>
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {engine !== "text" && phase === "interrupted" && current && (
            <button
              type="button"
              className="rx-p-textbtn"
              onClick={() => {
                const i = questions.indexOf(nextMissing);
                setStage(i < 0 ? { kind: "note" } : { kind: "question", i });
                setEngine("text");
                setVoice((v) => ({ ...v, error: "" }));
                setPhase("live");
              }}
            >
              Continue by typing
            </button>
          )}

          {engine === "text" && phase === "live" && (
            <form
              className="rx-p-text-reply"
              onSubmit={(e) => {
                e.preventDefault();
                if (stage.kind === "note") finishText();
                else advanceText(textAnswer);
              }}
            >
              <label htmlFor="checkin-text-answer">
                {stage.kind === "note"
                  ? "Anything else you want your care team to know?"
                  : "Your answer"}
              </label>
              <textarea
                id="checkin-text-answer"
                rows={2}
                maxLength={500}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type in your own words…"
                autoComplete="off"
              />
              <div className="rx-p-text-reply-actions">
                <small>{textAnswer.length}/500</small>
                <button type="submit" className="rx-p-btn primary">
                  {stage.kind === "note" ? "Finish check-in" : "Send answer"}
                </button>
                {stage.kind === "note" && (
                  <button
                    type="button"
                    className="rx-p-textbtn"
                    onClick={() => finishText(true)}
                  >
                    Nothing else
                  </button>
                )}
              </div>
            </form>
          )}

          {phase === "review" && reviewDraft && (
            <section
              className="rx-p-card rx-p-voice-review"
              aria-label="Review check-in answers"
            >
              <h2>Review what Relay heard</h2>
              <p>
                Check the answers below. The conversation above will be shared
                with your care team too.
              </p>
              <dl>
                {questions.map((q) => (
                  <div key={q}>
                    <dt>{QUESTIONS[q].short}</dt>
                    <dd>
                      <select
                        aria-label={`Answer for ${QUESTIONS[q].short}`}
                        value={reviewDraft.answers[q] || ""}
                        onChange={(e) =>
                          setReviewDraft((current) => ({
                            ...current,
                            answers: {
                              ...current.answers,
                              [q]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">
                          {reviewDraft.textAnswers?.[q]
                            ? "Optional: add a structured answer"
                            : "Choose an answer"}
                        </option>
                        {QUESTIONS[q].options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                ))}
              </dl>
              <label className="rx-p-voice-note">
                Add a note for your care team (optional)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={reviewDraft.note}
                  onChange={(e) =>
                    setReviewDraft((current) => ({
                      ...current,
                      note: e.target.value,
                    }))
                  }
                />
                <small>{reviewDraft.note.length}/1000</small>
              </label>
              <label className="rx-p-voice-consent">
                <input
                  type="checkbox"
                  checked={shareConsent}
                  onChange={(e) => setShareConsent(e.target.checked)}
                />
                <span>I agree to share these answers with my care team.</span>
              </label>
              <button
                type="button"
                className="rx-p-btn primary"
                disabled={
                  !shareConsent ||
                  !questions.every(
                    (q) =>
                      reviewDraft.answers[q] ||
                      (engine === "text" && reviewDraft.textAnswers?.[q]),
                  )
                }
                onClick={submitVoiceDraft}
              >
                Share check-in with my care team
              </button>
              <button
                type="button"
                className="rx-p-textbtn"
                onClick={() => {
                  setReviewDraft(null);
                  setPhase("idle");
                  setVoice((v) => ({ ...v, status: "" }));
                  answersRef.current = {};
                  setAnswers({});
                  setTextAnswers({});
                }}
              >
                Discard this draft
              </button>
            </section>
          )}

          {phase === "sending" && (
            <section
              className="rx-p-card rx-p-delivery"
              role="status"
              aria-live="polite"
            >
              <strong>
                {syncStatus === "offline"
                  ? "Waiting for connection"
                  : "Sending your check-in"}
              </strong>
              <p>
                {syncStatus === "offline"
                  ? "Your answers are saved here and will be sent when the care service reconnects."
                  : "Your answers and any note are being delivered to your care team."}
              </p>
            </section>
          )}

          {Object.keys(answers).length > 0 && (
            <div className="rx-p-answers" aria-label="Recorded answers">
              {questions
                .filter((q) => answers[q])
                .map((q) => (
                  <span key={q} className="rx-p-chip">
                    {QUESTIONS[q].short}: <strong>{answers[q]}</strong>
                  </span>
                ))}
            </div>
          )}

          {phase === "done" && (
            <section className="rx-p-card" aria-label="Sent">
              <p className="rx-p-sent">
                <span>
                  <CheckCircle2 size={18} aria-hidden="true" /> Sent to your
                  care team. Your check-in is now available in your patient
                  record.
                </span>
              </p>
              <div className="rx-p-stack">
                <a className="rx-p-textbtn" href="#/patient">
                  Back to home
                </a>
              </div>
            </section>
          )}
        </main>
        <aside className="rx-p-checkin-aside" aria-label="Check-in context">
          <section className="rx-p-card rx-p-focus-card">
            <div className="rx-p-aside-heading">
              <HeartPulse size={18} />
              <h2>What Relay noticed</h2>
            </div>
            {visibleSignals.length ? (
              <>
                <p className="rx-p-aside-copy">
                  These readings are different from your own usual range. They
                  help focus this conversation; they do not explain the cause.
                </p>
                <ul className="rx-p-focus-list">
                  {visibleSignals.map((signal, index) => (
                    <li key={`${signal.label}-${index}`}>
                      <span>
                        <i aria-hidden="true" />
                        {signal.label}
                      </span>
                      <strong>
                        {signal.direction.toLowerCase()} · {signal.duration}
                      </strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="rx-p-aside-copy">
                No specific reading change is driving this check-in. Relay will
                ask about your recovery plan and how you feel.
              </p>
            )}
            <small>
              {modelUsed
                ? checkinPlan.analysis?.execution?.mode ===
                    "Render Workflows" &&
                  !checkinPlan.analysis?.execution?.modelFallback
                  ? "Render Workflow analysis completed for this session."
                  : checkinPlan.analysis?.execution?.modelFallback
                    ? "Workflow completed; deterministic rules were used because the Python model was unavailable."
                    : checkinPlan.analysis?.execution?.fallback
                      ? "Fallback analysis used; it was not a Render Workflow run."
                      : "Analysis checked for this session."
                : scoreAttempted
                  ? "Using recent readings and your discharge plan."
                  : "A fresh score is requested when you begin."}
            </small>
          </section>
          <section className="rx-p-card rx-p-next-card">
            <h2>At your pace.</h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Talk it through</strong>
                  <small>Speak or tap an answer.</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Review the notes</strong>
                  <small>Correct anything Relay gets wrong.</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Choose what to share</strong>
                  <small>Nothing is sent before you approve it.</small>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>

      <p className="rx-p-fine">
        Nothing Relay says is a diagnosis. Feeling very unwell? Follow the
        emergency instructions in your discharge papers.
      </p>
    </>
  );
}

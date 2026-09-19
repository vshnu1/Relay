import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  HeartPulse,
  Mic,
  MessageCircle,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { actions, useSyncStatus } from "../useRecovery.js";
import { QUESTIONS, SIGNALS } from "../model/profiles.js";
import {
  checkinDue,
  checkinTriggerKey,
  checkinWhy,
} from "../model/schedule.js";
import { useAnalysis } from "./useAnalysis.js";
import { startPatientVoiceSession, voiceAvailable } from "./voice.js";
import { buildCheckinPlan } from "./checkinPlan.js";

// The check-in is one conversation. Relay opens by saying why it is checking in
// (daily for the first week home, every other day after, or because the readings
// moved), then talks through the profile's questions. With ELEVENLABS_API_KEY on
// the server the ElevenLabs agent runs it, reading the readings and the model's
// result first. Without it the browser speaks and listens itself; the questions,
// the answers and what happens afterwards are the same either way.

const canSpeak = () => typeof speechSynthesis !== "undefined";
const Recognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function matchOption(text, options) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  const direct = options.find((o) => o.toLowerCase() === t);
  if (direct) return direct;
  const has = (...words) => words.some((w) => t.includes(w));
  if (
    options.includes("A lot") &&
    has("a lot", "lot", "much", "very", "really", "worse", "badly")
  )
    return "A lot";
  if (
    options.includes("A little") &&
    has("little", "bit", "slight", "some", "kind of", "somewhat")
  )
    return "A little";
  if (
    options.includes("Not sure") &&
    has("not sure", "unsure", "don't know", "dont know", "maybe", "hard to say")
  )
    return "Not sure";
  if (
    options.includes("Yes") &&
    has("yes", "yeah", "yep", "i have", "i did", "i am")
  )
    return "Yes";
  if (
    options.includes("No") &&
    has(
      "no",
      "nope",
      "not really",
      "haven't",
      "havent",
      "didn't",
      "didnt",
      "same",
    )
  )
    return "No";
  return null;
}

const STATUS = {
  "": "Not started",
  connecting: "Connecting…",
  connected: "Listening",
  ended: "Call ended",
  browser: "Listening",
  review: "Review your answers",
};

export default function Checkin({ patient: p }) {
  const [checkinPlan, setCheckinPlan] = useState(() => buildCheckinPlan(p));
  const questions = checkinPlan.questions;
  const due = checkinDue(p);
  const why = checkinWhy(p);
  const { run: score } = useAnalysis(p);
  const [phase, setPhase] = useState("idle"); // idle | live | review | sending | done
  const [engine, setEngine] = useState(null); // elevenlabs | browser
  const [log, setLog] = useState([]);
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState({ kind: "question", i: 0 });
  const [voice, setVoice] = useState({
    available: false,
    status: "",
    error: "",
  });
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [shareConsent, setShareConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [modelUsed, setModelUsed] = useState(false);
  const [scoreAttempted, setScoreAttempted] = useState(false);
  const [listening, setListening] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const syncStatus = useSyncStatus();
  const sessionRef = useRef(null);
  const recRef = useRef(null);
  const endRef = useRef(null);
  const answersRef = useRef({});
  const completedDraftRef = useRef(null);
  const endingByPatientRef = useRef(false);

  useEffect(() => {
    let live = true;
    voiceAvailable().then(
      (ok) => live && setVoice((v) => ({ ...v, available: ok })),
    );
    return () => {
      live = false;
      sessionRef.current?.endSession?.();
      recRef.current?.stop?.();
      if (canSpeak()) speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  const say = (who, text) => setLog((l) => [...l, { who, text }]);

  const finish = (all, note) => {
    if (sessionRef.current) endingByPatientRef.current = true;
    sessionRef.current?.endSession?.();
    sessionRef.current = null;
    completedDraftRef.current = null;
    setReviewDraft({ answers: all, note: (note || "").slice(0, 500) });
    setShareConsent(false);
    setPhase("review");
    setVoice((v) => ({ ...v, status: "review" }));
  };

  // ---- ElevenLabs path -------------------------------------------------------
  const startAgent = async (plan) => {
    if (!voiceConsent) return;
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
        onAnswers: (a, note) => {
          const merged = { ...answersRef.current, ...a };
          answersRef.current = merged;
          setAnswers(merged);
          say(
            "you",
            Object.entries(a)
              .map(([q, v]) => `${QUESTIONS[q].short}: ${v}`)
              .join(". ") + (note ? `. ${note}` : ""),
          );
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
            finish(draft.answers, draft.note);
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
                : "The voice call ended before the check-in was complete. Nothing has been shared. Finish with the answer buttons below."),
          }));
        },
      });
    } catch (e) {
      setVoice((v) => ({ ...v, status: "", error: e.message || String(e) }));
      setPhase("idle");
      setEngine(null);
    }
  };

  // ---- Browser speech path -----------------------------------------------------
  const speak = (text, then) => {
    say("relay", text);
    if (!canSpeak()) return then?.();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.97;
    u.onend = () => then?.();
    speechSynthesis.speak(u);
  };
  const listen = (onText) => {
    if (!Recognition) return;
    const rec = new Recognition();
    recRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };
  const askQuestion = (i, prefix = "", plan = checkinPlan) => {
    const q = QUESTIONS[plan.questions[i]];
    setStage({ kind: "question", i });
    speak(`${prefix}${q.text}`, () =>
      listen((text) => {
        const match = matchOption(text, q.options);
        if (match) return answerBrowser(i, match, text, plan);
        say("you", text);
        speak(
          `I did not catch that. You can say ${q.options.join(", or ")}.`,
          () =>
            listen((again) => {
              const m = matchOption(again, q.options);
              if (m) answerBrowser(i, m, again, plan);
              else say("you", again);
            }),
        );
      }),
    );
  };
  const answerBrowser = (i, option, spokenText, plan = checkinPlan) => {
    const next = { ...answersRef.current, [plan.questions[i]]: option };
    answersRef.current = next;
    setAnswers(next);
    say("you", spokenText || option);
    if (i + 1 < plan.questions.length)
      askQuestion(i + 1, i === 0 ? "Thanks. " : "", plan);
    else {
      setStage({ kind: "note" });
      speak(
        `Thank you. ${plan.contextPrompt} Say no if you have nothing to add.`,
        () =>
          listen((text) => {
            say("you", text);
            const none =
              /^(no|nope|nothing|no thanks|that's all|thats all)\b/i.test(
                text.trim(),
              );
            finishBrowser(none ? null : text);
          }),
      );
    }
  };
  const finishBrowser = (note) => {
    setStage({ kind: "done" });
    speak(
      "Your check-in is ready. Please review your answers and choose whether to share them with your care team.",
    );
    finish(answersRef.current, note);
  };
  const startBrowser = (plan) => {
    setEngine("browser");
    setPhase("live");
    setVoice((v) => ({ ...v, status: "browser", error: "" }));
    speak(
      `Hi ${p.first}. This is Relay, checking in on day ${p.dayHome} of your recovery after ${p.profile.after}. ${why} I have ${plan.questions.length} short questions. Nothing I say is a diagnosis.`,
      () => askQuestion(0, "", plan),
    );
  };

  const startCheckin = async () => {
    if (voice.available && !voiceConsent) return;
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
    if (voice.available) await startAgent(nextPlan);
    else startBrowser(nextPlan);
  };

  const stop = () => {
    endingByPatientRef.current = true;
    sessionRef.current?.endSession?.();
    sessionRef.current = null;
    recRef.current?.stop?.();
    if (canSpeak()) speechSynthesis.cancel();
    setVoice((v) => ({ ...v, status: "ended" }));
    if (phase !== "done") setPhase("idle");
  };

  // Answer taps stay hidden during an active conversation so the patient can
  // respond naturally. They remain available if voice is interrupted.
  const tap = (option) => {
    const missing = questions.filter((q) => !answersRef.current[q]);
    if (!missing.length) return;
    const q = missing[0];
    const i = questions.indexOf(q);
    if (engine === "browser") {
      recRef.current?.stop?.();
      if (canSpeak()) speechSynthesis.cancel();
      answerBrowser(i, option);
    } else {
      const next = { ...answersRef.current, [q]: option };
      answersRef.current = next;
      setAnswers(next);
      say("you", `${QUESTIONS[q].short}: ${option}`);
      // Send accessibility/tap answers into the live agent conversation too.
      // This lets Relay acknowledge the last answer, ask the optional context
      // question, and call the draft tool before the call ends.
      sessionRef.current?.sendUserMessage?.(
        `For “${QUESTIONS[q].text}”, my answer is “${option}”.`,
      );
    }
  };
  const nextMissing = questions.find((q) => !answers[q]) || null;
  const current =
    (phase === "live" || phase === "interrupted") &&
    nextMissing &&
    stage.kind !== "note"
      ? QUESTIONS[nextMissing]
      : null;
  const status = STATUS[voice.status] ?? voice.status;
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
    const complete = questions.every((q) => reviewDraft.answers[q]);
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
    if (reviewDraft.note.trim())
      deliveries.push(actions.sendNote(p.id, reviewDraft.note.trim()));
    score(reviewDraft.answers);
    const results = await Promise.all(deliveries);
    if (results.every((result) => result?.delivered)) {
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
                : `Day ${p.dayHome} check-in`}
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
                {phase === "done" ? "Sent" : listening ? "Listening" : status}
              </span>
              <span className="rx-p-fine">
                {questions.length} questions
                {checkinPlan.priority
                  ? ", about two minutes"
                  : ", about one minute"}
                . Speak naturally or tap an answer.
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
                {voice.available && (
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
                  disabled={preparing || (voice.available && !voiceConsent)}
                  onClick={startCheckin}
                >
                  <PhoneCall size={18} aria-hidden="true" />{" "}
                  {preparing
                    ? "Preparing check-in…"
                    : checkinPlan.priority
                      ? "Start priority check-in"
                      : "Start daily check-in"}
                </button>
                <small className="rx-p-fine">
                  {modelUsed
                    ? "Questions are focused using the latest Relay score and your discharge plan."
                    : scoreAttempted
                      ? "The scorer could not be reached, so questions use your discharge plan and recent reading changes."
                      : checkinPlan.mode === "insufficient"
                        ? "There are not enough recent readings to compare yet. We’ll focus on how you feel and your discharge plan."
                        : "Your latest readings will be checked when you start, so the questions can focus on what matters today."}
                </small>
                {!voice.available && (
                  <small className="rx-p-fine">
                    Using this browser's own voice. The ElevenLabs agent takes
                    over when the server has its key.
                  </small>
                )}
              </div>
            )}
            {phase === "live" && (
              <div className="rx-p-live-controls">
                <span className="rx-p-live-indicator">
                  <span /> {listening ? "Listening to you" : status}
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
                The call ended early. Tap an answer to finish this check-in;
                your answers will still need your review before sharing.
              </p>
            )}
            {voice.error && (
              <p className="rx-p-error" role="alert">
                {voice.error}
              </p>
            )}
          </section>

          {log.length > 0 && (phase === "live" || phase === "interrupted") && (
            <div
              className="rx-p-chat rx-p-transcript"
              role="log"
              aria-live="polite"
            >
              {log.map((m, i) => (
                <div key={i} className={`rx-p-bubble ${m.who}`}>
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {current && phase === "interrupted" && (
            <div className="rx-p-quick" role="group" aria-label="Tap an answer">
              {listening && (
                <span className="rx-p-pill live">
                  <Mic size={13} aria-hidden="true" /> {current.short}
                </span>
              )}
              {current.options.map((o) => (
                <button key={o} type="button" onClick={() => tap(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}

          {phase === "live" &&
            stage.kind === "note" &&
            engine === "browser" && (
              <form
                className="rx-p-quick rx-p-noteform"
                role="group"
                aria-label="Anything else"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = noteDraft.trim();
                  recRef.current?.stop?.();
                  if (canSpeak()) speechSynthesis.cancel();
                  if (text) say("you", text);
                  finishBrowser(text || null);
                }}
              >
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Or type anything else here"
                  aria-label="Anything else for your care team"
                />
                <button type="submit">
                  {noteDraft.trim()
                    ? "Send and finish"
                    : "Nothing else, finish"}
                </button>
              </form>
            )}

          {phase === "review" && reviewDraft && (
            <section
              className="rx-p-card rx-p-voice-review"
              aria-label="Review check-in answers"
            >
              <h2>Review what Relay heard</h2>
              <p>Correct anything that is wrong before sharing it.</p>
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
                        <option value="">Choose an answer</option>
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
                Additional context
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reviewDraft.note}
                  onChange={(e) =>
                    setReviewDraft((current) => ({
                      ...current,
                      note: e.target.value,
                    }))
                  }
                />
                <small>{reviewDraft.note.length}/500</small>
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
                  !questions.every((q) => reviewDraft.answers[q])
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
                ? "Relay score checked for this session."
                : scoreAttempted
                  ? "Using recent readings and your discharge plan."
                  : "A fresh score is requested when you begin."}
            </small>
          </section>
          <section className="rx-p-card rx-p-next-card">
            <h2>At your pace</h2>
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

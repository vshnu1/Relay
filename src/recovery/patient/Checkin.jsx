import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Mic,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { actions } from "../useRecovery.js";
import { QUESTIONS } from "../model/profiles.js";
import { checkinDue, checkinWhy } from "../model/schedule.js";
import { useAnalysis } from "./useAnalysis.js";
import { startPatientVoiceSession, voiceAvailable } from "./voice.js";

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
};

export default function Checkin({ patient: p }) {
  const questions = p.questions || p.profile.questions;
  const due = checkinDue(p);
  const why = checkinWhy(p);
  const { run: score } = useAnalysis(p);
  const [phase, setPhase] = useState("idle"); // idle | live | done
  const [engine, setEngine] = useState(null); // elevenlabs | browser
  const [log, setLog] = useState([]);
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState({ kind: "question", i: 0 });
  const [voice, setVoice] = useState({
    available: false,
    status: "",
    error: "",
  });
  const [listening, setListening] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const sessionRef = useRef(null);
  const recRef = useRef(null);
  const endRef = useRef(null);
  const answersRef = useRef({});

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
    actions.submitCheckin(p.id, all);
    if (note) actions.sendNote(p.id, note);
    score(all); // the model re-scores with the answers in the background
    setPhase("done");
  };

  // ---- ElevenLabs path -------------------------------------------------------
  const startAgent = async () => {
    setEngine("elevenlabs");
    setPhase("live");
    setVoice((v) => ({ ...v, status: "connecting", error: "" }));
    try {
      sessionRef.current = await startPatientVoiceSession({
        patient: p,
        questions,
        consent: true,
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
          if (questions.every((q) => merged[q])) finish(merged, note);
        },
        onRecommendation: ({ action, reason }) => {
          say(
            "relay",
            `Recommendation: ${
              action === "send_report"
                ? "send a report to your care team"
                : action === "message_care_team"
                  ? "message your care team"
                  : "nothing to do now"
            }. ${reason}`,
          );
          if (action !== "none")
            sessionStorage.setItem(
              "rx-voice-recommendation",
              JSON.stringify({ action, reason }),
            );
        },
        onError: (e) =>
          setVoice((v) => ({ ...v, error: e?.message || String(e) })),
        onDisconnect: () => setVoice((v) => ({ ...v, status: "ended" })),
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
  const askQuestion = (i, prefix = "") => {
    const q = QUESTIONS[questions[i]];
    setStage({ kind: "question", i });
    speak(`${prefix}${q.text}`, () =>
      listen((text) => {
        const match = matchOption(text, q.options);
        if (match) return answerBrowser(i, match, text);
        say("you", text);
        speak(
          `I did not catch that. You can say ${q.options.join(", or ")}.`,
          () =>
            listen((again) => {
              const m = matchOption(again, q.options);
              if (m) answerBrowser(i, m, again);
              else say("you", again);
            }),
        );
      }),
    );
  };
  const answerBrowser = (i, option, spokenText) => {
    const next = { ...answersRef.current, [questions[i]]: option };
    answersRef.current = next;
    setAnswers(next);
    say("you", spokenText || option);
    if (i + 1 < questions.length) askQuestion(i + 1, i === 0 ? "Thanks. " : "");
    else {
      setStage({ kind: "note" });
      speak(
        "Thank you. Is there anything else you want your care team to know? Say no if not.",
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
      "Sent to your care team together with your readings. The app will now show what this means for you today.",
    );
    finish(answersRef.current, note);
  };
  const startBrowser = () => {
    setEngine("browser");
    setPhase("live");
    setVoice((v) => ({ ...v, status: "browser", error: "" }));
    speak(
      `Hi ${p.first}. This is Relay, checking in on day ${p.dayHome} of your recovery after ${p.profile.after}. ${why} I have ${questions.length} short questions. Nothing I say is a diagnosis.`,
      () => askQuestion(0),
    );
  };

  const stop = () => {
    sessionRef.current?.endSession?.();
    sessionRef.current = null;
    recRef.current?.stop?.();
    if (canSpeak()) speechSynthesis.cancel();
    setVoice((v) => ({ ...v, status: "ended" }));
    if (phase !== "done") setPhase("idle");
  };

  // Tapping an answer works in both engines: it is the fallback when the room is
  // loud or the microphone is refused, and the demo never stalls on it.
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
      if (questions.every((k) => next[k])) finish(next, null);
    }
  };
  const nextMissing = questions.find((q) => !answers[q]) || null;
  const current =
    phase === "live" && nextMissing && stage.kind !== "note"
      ? QUESTIONS[nextMissing]
      : null;
  const status = STATUS[voice.status] ?? voice.status;

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
                ? "Your readings changed"
                : `Day ${p.dayHome} check-in`}
          </span>
          <h1 className="rx-p-title">Talk to Relay</h1>
          <p className="rx-p-lead">{why}</p>
        </div>
      </header>

      <section className="rx-p-card rx-p-callcard" aria-label="Check-in call">
        <div className="rx-p-callrow">
          <span className={`rx-p-pill ${phase}`}>
            {phase === "done" ? "Sent" : listening ? "Listening" : status}
          </span>
          <span className="rx-p-fine">
            {questions.length} questions, about two minutes. Speak naturally;
            you can also tap an answer.
          </span>
        </div>
        {phase === "idle" && (
          <div className="rx-p-stack">
            <button
              type="button"
              className="rx-p-btn primary"
              onClick={voice.available ? startAgent : startBrowser}
            >
              <PhoneCall size={18} aria-hidden="true" /> Start check-in
            </button>
            {!voice.available && (
              <small className="rx-p-fine">
                Using this browser's own voice. The ElevenLabs agent takes over
                when the server has its key.
              </small>
            )}
          </div>
        )}
        {phase === "live" && (
          <button type="button" className="rx-p-btn" onClick={stop}>
            <PhoneOff size={18} aria-hidden="true" /> End
          </button>
        )}
        {voice.error && (
          <p className="rx-p-error" role="alert">
            {voice.error}
          </p>
        )}
      </section>

      {log.length > 0 && (
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

      {current && (
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

      {phase === "live" && stage.kind === "note" && engine === "browser" && (
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
            {noteDraft.trim() ? "Send and finish" : "Nothing else, finish"}
          </button>
        </form>
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
              <CheckCircle2 size={18} aria-hidden="true" /> Sent to your care
              team, together with your readings
            </span>
          </p>
          <div className="rx-p-stack">
            <a className="rx-p-btn primary" href="#/patient/insight">
              What this means for me
            </a>
            <a className="rx-p-textbtn" href="#/patient">
              Back to home
            </a>
          </div>
        </section>
      )}

      <p className="rx-p-fine">
        Nothing Relay says is a diagnosis. Feeling very unwell? Follow the
        emergency instructions in your discharge papers.
      </p>
    </>
  );
}

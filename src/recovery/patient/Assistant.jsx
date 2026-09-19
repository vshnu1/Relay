import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Mic, Send, Volume2, VolumeX } from "lucide-react";
import { actions } from "../useRecovery.js";
import { QUESTIONS } from "../model/profiles.js";

// A conversational check-in: the same profile questions, asked one at a time in a
// chat, answered by tapping, typing, or speaking. It is scripted, not a chatbot: it
// never interprets symptoms, only collects the structured answers and a note.
// Voice uses the browser's own speech services; ElevenLabs can replace them when
// the API key is configured on the server.

const canSpeak = () => typeof speechSynthesis !== "undefined";
const Recognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function matchOption(text, options) {
  const t = text.trim().toLowerCase();
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

export default function Assistant({ patient: p }) {
  const questions = p.profile.questions;
  const [log, setLog] = useState([
    {
      who: "relay",
      text: `Hi ${p.first}. I will ask ${questions.length} short questions for your care team at ${p.hospital}. Nothing I say is a diagnosis. Tap an answer, type it, or speak it.`,
    },
    { who: "relay", text: QUESTIONS[questions[0]].text, ask: questions[0] },
  ]);
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState({ kind: "question", i: 0 });
  const [draft, setDraft] = useState("");
  const [aloud, setAloud] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const recRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [log]);
  useEffect(() => () => canSpeak() && speechSynthesis.cancel(), []);
  const say = (entry) => {
    setLog((l) => [...l, entry]);
    if (entry.who === "relay" && aloud && canSpeak()) {
      const u = new SpeechSynthesisUtterance(entry.text);
      u.rate = 0.95;
      speechSynthesis.speak(u);
    }
  };

  const answer = (option) => {
    const q = questions[stage.i];
    const next = { ...answers, [q]: option };
    setAnswers(next);
    say({ who: "you", text: option });
    if (stage.i + 1 < questions.length) {
      const nq = questions[stage.i + 1];
      setStage({ kind: "question", i: stage.i + 1 });
      say({ who: "relay", text: QUESTIONS[nq].text, ask: nq });
    } else {
      setStage({ kind: "note" });
      say({
        who: "relay",
        text: "Thank you. Is there anything else you want your care team to know? Type or say it, or tap Skip.",
      });
    }
  };
  const submitText = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (stage.kind === "question") {
      const q = questions[stage.i];
      const match = matchOption(text, QUESTIONS[q].options);
      if (match) return answer(match);
      say({ who: "you", text });
      say({
        who: "relay",
        text: `I did not catch that. Please answer ${QUESTIONS[q].options.join(", ")}.`,
      });
    } else if (stage.kind === "note") {
      say({ who: "you", text });
      finish(text);
    }
  };
  const finish = (note) => {
    actions.submitCheckin(p.id, answers);
    if (note) actions.sendNote(p.id, note);
    setStage({ kind: "done" });
    say({
      who: "relay",
      text: "Sent to your care team, together with your readings. Tap below to see what it means for you today.",
    });
  };
  const listen = () => {
    if (!Recognition) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    recRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setDraft(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };
  const current =
    stage.kind === "question" ? QUESTIONS[questions[stage.i]] : null;
  return (
    <>
      <header className="rx-p-stephead">
        <div>
          <a className="rx-p-back" href="#/patient">
            <ChevronLeft size={20} /> Home
          </a>
          <span>Relay assistant</span>
          {canSpeak() && (
            <button
              type="button"
              className="rx-p-iconbtn"
              aria-pressed={aloud}
              aria-label={aloud ? "Stop reading aloud" : "Read aloud"}
              onClick={() => {
                if (aloud) speechSynthesis.cancel();
                setAloud(!aloud);
              }}
            >
              {aloud ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          )}
        </div>
      </header>
      <div className="rx-p-chat" role="log" aria-live="polite">
        {log.map((m, i) => (
          <div key={i} className={`rx-p-bubble ${m.who}`}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {current && (
        <div className="rx-p-quick" role="group" aria-label="Quick answers">
          {current.options.map((o) => (
            <button key={o} type="button" onClick={() => answer(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      {stage.kind === "note" && (
        <div className="rx-p-quick">
          <button type="button" onClick={() => finish(null)}>
            Skip
          </button>
        </div>
      )}
      {stage.kind === "done" ? (
        <div className="rx-p-stack bottom">
          <a className="rx-p-btn primary" href="#/patient/insight">
            What this means for me
          </a>
        </div>
      ) : (
        <form
          className="rx-p-input bottom"
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
        >
          {Recognition && (
            <button
              type="button"
              className={`rx-p-iconbtn ${listening ? "live" : ""}`}
              aria-label={listening ? "Stop listening" : "Speak your answer"}
              onClick={listen}
            >
              <Mic size={20} />
            </button>
          )}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              listening
                ? "Listening…"
                : stage.kind === "note"
                  ? "Anything else?"
                  : "Type your answer"
            }
            aria-label="Your message"
          />
          <button
            type="submit"
            className="rx-p-iconbtn"
            aria-label="Send"
            disabled={!draft.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      )}
    </>
  );
}

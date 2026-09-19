import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Volume2 } from "lucide-react";
import { actions } from "../useRecovery.js";
import { QUESTIONS } from "../model/profiles.js";
import { checkinDue } from "../model/schedule.js";

const canSpeak = () => typeof speechSynthesis !== "undefined";
function speak(text) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// question -> review -> more -> done. The required answers are sent at "review",
// so skipping the free-text step never loses them. Questions come from the watch
// profile and map one-to-one onto the ML model's context fields.
export default function Checkin({ patient: p }) {
  const questions = p.profile.questions;
  const due = checkinDue(p);
  const [mode, setMode] = useState("question");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [note, setNote] = useState("");
  const [sentNote, setSentNote] = useState(false);
  const [aloud, setAloud] = useState(false);
  const spoken = useRef(null);
  useEffect(() => {
    if (mode === "question" && aloud && spoken.current !== step) {
      spoken.current = step;
      speak(
        `${QUESTIONS[questions[step]].text} ${QUESTIONS[questions[step]].options.join(", or ")}?`,
      );
    }
  }, [mode, step, aloud, questions]);
  useEffect(() => () => canSpeak() && speechSynthesis.cancel(), []);

  if (mode === "question") {
    const id = questions[step];
    return (
      <>
        <header className="rx-p-stephead">
          <div>
            {step === 0 ? (
              <a className="rx-p-back" href="#/patient">
                <ChevronLeft size={20} /> Home
              </a>
            ) : (
              <button
                type="button"
                className="rx-p-back"
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft size={20} /> Back
              </button>
            )}
            <span>
              Question {step + 1} of {questions.length}
            </span>
          </div>
          <div className="rx-p-progress" aria-hidden="true">
            {questions.map((q, i) => (
              <i key={q} className={i <= step ? "on" : ""} />
            ))}
          </div>
        </header>
        {step === 0 && (
          <p className="rx-p-fine">
            {due.reason === "asked"
              ? "Your readings changed. These questions help your care team understand why."
              : `Day ${p.dayHome} check-in. Your answers are scored together with your readings.`}
          </p>
        )}
        <h1 className="rx-p-question">{QUESTIONS[id].text}</h1>
        <div className="rx-p-options" role="group" aria-label="Your answer">
          {QUESTIONS[id].options.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={answers[id] === option}
              onClick={() => {
                setAnswers({ ...answers, [id]: option });
                if (step === questions.length - 1) setMode("review");
                else setStep(step + 1);
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="rx-p-stack bottom">
          {canSpeak() && (
            <button
              type="button"
              className="rx-p-btn"
              aria-pressed={aloud}
              onClick={() => {
                const next = !aloud;
                setAloud(next);
                spoken.current = null;
                if (!next) speechSynthesis.cancel();
              }}
            >
              <Volume2 size={22} aria-hidden="true" />{" "}
              {aloud ? "Stop reading aloud" : "Read the questions aloud"}
            </button>
          )}
          <a className="rx-p-textbtn" href="#/patient/assistant">
            Prefer to talk it through? Use the assistant
          </a>
        </div>
      </>
    );
  }

  if (mode === "review")
    return (
      <>
        <h1 className="rx-p-title">Check your answers</h1>
        <div className="rx-p-card list">
          {questions.map((id, i) => (
            <div className="rx-p-answer" key={id}>
              <div>
                <span>{QUESTIONS[id].short}</span>
                <strong>{answers[id]}</strong>
              </div>
              <button
                type="button"
                onClick={() => (setStep(i), setMode("question"))}
              >
                Change
              </button>
            </div>
          ))}
        </div>
        <label className="rx-p-consent">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>Share these answers with my care team at {p.hospital}.</span>
        </label>
        <button
          type="button"
          className="rx-p-btn primary bottom"
          disabled={!agreed}
          onClick={() => {
            actions.submitCheckin(p.id, answers);
            setMode("more");
          }}
        >
          Send to my care team
        </button>
      </>
    );

  if (mode === "more")
    return (
      <>
        <div className="rx-p-sent">
          <span>
            <CheckCircle2 size={22} aria-hidden="true" /> Your answers were sent
          </span>
          <h1 className="rx-p-title small">
            Is there anything else you want your care team to know?
          </h1>
        </div>
        <div className="rx-p-field">
          <label htmlFor="rx-note">Your message. You can skip this.</label>
          <textarea
            id="rx-note"
            rows="4"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: how you slept, a new symptom, or a question."
          />
        </div>
        <p className="rx-p-fine">
          Your care team reads messages during working hours, not right away. If
          you feel very unwell, follow the emergency instructions in your
          discharge papers.
        </p>
        <div className="rx-p-stack bottom">
          <button
            type="button"
            className="rx-p-btn primary"
            disabled={!note.trim()}
            onClick={() => {
              actions.sendNote(p.id, note.trim());
              setSentNote(true);
              setMode("done");
            }}
          >
            Send my message
          </button>
          <button
            type="button"
            className="rx-p-textbtn"
            onClick={() => setMode("done")}
          >
            No, I am finished
          </button>
        </div>
      </>
    );

  return (
    <>
      <div className="rx-p-done">
        <CheckCircle2
          size={56}
          strokeWidth={1.8}
          color="#2f7a62"
          aria-hidden="true"
        />
        <h1 className="rx-p-title">All done. Thank you.</h1>
        <p>
          {sentNote
            ? "Your answers and your message were sent. "
            : "Your answers were sent. "}
          They are scored together with your readings. See what that means for
          you today.
        </p>
      </div>
      <div className="rx-p-stack bottom">
        <a className="rx-p-btn primary" href="#/patient/insight">
          What this means for me
        </a>
        <a className="rx-p-textbtn" href="#/patient">
          Back to home
        </a>
      </div>
    </>
  );
}

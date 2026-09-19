import { useState } from "react";
import { CheckCircle2, ChevronLeft, Mic } from "lucide-react";
import { actions, useRecovery } from "../useRecovery.js";
import { QUESTIONS } from "../data/profiles.js";

// question -> review -> more -> done. The required answers are sent at "review",
// so skipping the free-text step never loses them.
export default function Checkin({ patient: p }) {
  const { capabilities } = useRecovery();
  const questions = p.profile.questions;
  const [mode, setMode] = useState("question");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [note, setNote] = useState("");
  const [sentNote, setSentNote] = useState(false);

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
        {capabilities.voice && (
          <button type="button" className="rx-p-btn bottom">
            <Mic size={22} aria-hidden="true" /> Answer by voice instead
          </button>
        )}
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
          <span>Share these answers with my care team at [HOSPITAL NAME].</span>
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
        {capabilities.voice && (
          <button type="button" className="rx-p-btn">
            <Mic size={22} aria-hidden="true" /> Say it instead
          </button>
        )}
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
          Your care team reads them during working hours, together with your
          watch readings. If you feel very unwell, follow the emergency
          instructions in your discharge papers.
        </p>
      </div>
      <a className="rx-p-btn primary" href="#/patient">
        Back to home
      </a>
    </>
  );
}

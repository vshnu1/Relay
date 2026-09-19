import { ChevronLeft, CircleCheck, MessageSquare } from "lucide-react";
import { numberWord } from "../format.js";

// Words only. The patient never sees a number or a chart; the same readings reach
// the doctor's view in full.
function phrase(s) {
  if (s.today === null) return "No reading yet today.";
  if (s.towardDays === 0) return "About your usual.";
  const word = s.watchDir > 0 ? s.up : s.down;
  return s.towardDays === 1
    ? `${word} than your usual since yesterday.`
    : `${word} than your usual for the last ${s.towardDays} ${s.span}.`;
}

export default function Watching({ patient: p }) {
  const changed = p.changedForPatient;
  const started = Math.max(0, ...changed.map((s) => s.towardDays));
  return (
    <>
      <a className="rx-p-back" href="#/patient">
        <ChevronLeft size={20} /> Home
      </a>
      <span className="rx-p-eyebrow">Your recovery picture</span>
      <h1 className="rx-p-title">What your care team is watching</h1>
      <p className="rx-p-lead">
        After {p.profile.after}, your care team watches{" "}
        {numberWord(p.counted.length)} signals from your connected devices. Each
        one is compared with what was usual for you before your hospital stay.
      </p>
      <div className="rx-p-explain-card">
        <CircleCheck size={21} aria-hidden="true" />
        <div>
          <strong>We look for a pattern, not one odd reading.</strong>
          <span>
            Small changes can happen for ordinary reasons. Relay only asks for
            context when a change persists.
          </span>
        </div>
      </div>
      <div className="rx-p-card list">
        {p.counted.map((s) => (
          <div className="rx-p-signal" key={s.id}>
            <div>
              <strong>{s.plain}</strong>
              <span className={`rx-p-chip ${s.towardDays ? "changed" : ""}`}>
                {s.towardDays ? "Changed" : "Usual"}
              </span>
            </div>
            <p>{phrase(s)}</p>
            <small>{s.what}</small>
          </div>
        ))}
      </div>
      <div className="rx-p-explain">
        <h2>What a change means</h2>
        <p>
          A change is not a diagnosis. It can have a simple cause, like a poor
          night of sleep or a loose watch strap. That is why your care team asks
          you a few questions before anything else.
        </p>
        {started > 0 && (
          <p>
            These changes started{" "}
            {started === 1
              ? "yesterday"
              : `${numberWord(started)} ${changed[0].span} ago`}
            .
          </p>
        )}
      </div>
      {p.pending && (
        <a className="rx-p-btn primary" href="#/patient/checkin">
          <MessageSquare size={20} /> Answer their questions
        </a>
      )}
    </>
  );
}

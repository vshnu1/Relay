import { useState } from "react";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { actions } from "../useRecovery.js";
import { clock } from "../format.js";

const KINDS = [
  { id: "symptom", label: "A symptom" },
  { id: "medicine", label: "A medicine" },
  { id: "activity", label: "Activity or a fall" },
  { id: "food", label: "Food or drink" },
  { id: "other", label: "Something else" },
];

// Anything out of the ordinary, in the patient's own words, timestamped. It goes
// into the report the patient may send and is visible to the care team.
export default function Journal({ patient: p }) {
  const [kind, setKind] = useState("symptom");
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const entries = [...p.journal].reverse();
  return (
    <>
      <a className="rx-p-back" href="#/patient/readings">
        <ChevronLeft size={18} /> Readings
      </a>
      <h1 className="rx-p-title">Record something</h1>
      <p className="rx-p-lead">
        Anything that was not normal, in your own words. It is kept with the
        time, for you and your care team.
      </p>
      <form
        className="rx-p-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          actions.addJournal(
            p.id,
            KINDS.find((k) => k.id === kind).label.toLowerCase(),
            text.trim(),
          );
          setText("");
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }}
      >
        <div
          className="rx-p-quick"
          role="group"
          aria-label="What kind of thing"
        >
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="rx-p-field">
          <label htmlFor="rx-journal">What happened?</label>
          <textarea
            id="rx-journal"
            rows="4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: felt dizzy standing up after lunch; took an extra painkiller at 3pm; the wound looked pinker this morning."
          />
        </div>
        <button
          type="submit"
          className="rx-p-btn primary"
          disabled={!text.trim()}
        >
          Save
        </button>
        {saved && (
          <p className="rx-p-sent">
            <span>
              <CheckCircle2 size={20} aria-hidden="true" /> Saved with the time
            </span>
          </p>
        )}
      </form>
      {entries.length > 0 && (
        <section className="rx-p-card list" aria-label="What you recorded">
          <h2>What you recorded</h2>
          {entries.map((j) => (
            <div key={j.t} className="rx-p-entryrow">
              <span>
                {clock(j.t)} · {j.kind}
              </span>
              <p className="rx-serif">{j.text}</p>
            </div>
          ))}
        </section>
      )}
      <p className="rx-p-fine">
        If you feel very unwell, follow the emergency instructions in your
        discharge papers. This is not a way to reach someone urgently.
      </p>
    </>
  );
}

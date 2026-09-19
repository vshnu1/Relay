import Conversation from "../Conversation.jsx";
import { useState } from "react";
import { MessageSquare, NotebookPen } from "lucide-react";
import { actions } from "../useRecovery.js";

// What the care team gives the patient from here: messages, and discharge notes with
// medicines. What the patient sees under those headings is entered here during the
// demo, never pre-written. Follow-up appointments come with the record.
export default function CareTeamPanel({ patient: p, embedded = false }) {
  const [tab, setTab] = useState("message");
  const [notes, setNotes] = useState(p.notes || "");
  const [meds, setMeds] = useState((p.medications || []).join("\n"));
  const [saved, setSaved] = useState("");
  const flash = (msg) => {
    setSaved(msg);
    setTimeout(() => setSaved(""), 2500);
  };
  return (
    <section
      className={`rx-careteam${embedded ? " embedded" : " rx-card"}`}
      aria-label="Patient follow-up"
    >
      <div className="rx-careteam-head">
        <h2>Patient follow-up</h2>
        <span>Updates appear in {p.first}&apos;s app</span>
      </div>
      <div className="rx-seg" role="group" aria-label="What to add">
        {[
          ["message", "Message", MessageSquare],
          ["discharge", "Discharge notes", NotebookPen],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {tab === "message" && <Conversation patient={p} side="clinician" />}
      {tab === "discharge" && (
        <form
          className="rx-careteam-form"
          onSubmit={(e) => {
            e.preventDefault();
            actions.setDischarge(p.id, {
              notes: notes.trim(),
              medications: meds
                .split("\n")
                .map((m) => m.trim())
                .filter(Boolean),
            });
            flash("Discharge notes saved to the patient's profile.");
          }}
        >
          <label htmlFor="rx-notes">Notes from the doctor</label>
          <textarea
            id="rx-notes"
            rows="4"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was treated, what to expect, and when to call."
          />
          <label htmlFor="rx-meds">Medicines, one per line</label>
          <textarea
            id="rx-meds"
            rows="3"
            value={meds}
            onChange={(e) => setMeds(e.target.value)}
            placeholder="Amoxicillin 1 g, three times a day, until day 7"
          />
          <button type="submit" className="rx-btn primary">
            Save to profile
          </button>
        </form>
      )}
      {saved && <p className="rx-careteam-saved">{saved}</p>}
    </section>
  );
}

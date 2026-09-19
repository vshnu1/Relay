import { ChevronRight, LogOut } from "lucide-react";
import { dateLong, list } from "../format.js";

export default function Profile({ patient: p, onSignOut }) {
  const watching = p.counted.map((s) => s.plain.toLowerCase());
  return (
    <>
      <h1 className="rx-p-title">Your discharge</h1>
      <div className="rx-p-card list">
        <dl className="rx-p-kv">
          <div>
            <dt>Name</dt>
            <dd>
              {p.name}, {p.age}
            </dd>
          </div>
          <div>
            <dt>Discharged with</dt>
            <dd>{p.profile.name}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{p.hospital}</dd>
          </div>
          <div>
            <dt>Discharge date</dt>
            <dd>
              {dateLong(p.dischargedAt)}, after a {p.stayDays}-day stay
            </dd>
          </div>
          <div>
            <dt>Responsible clinician</dt>
            <dd>{p.clinician}</dd>
          </div>
          <div>
            <dt>Discharge code</dt>
            <dd>
              <code>{p.code}</code>
            </dd>
          </div>
        </dl>
      </div>
      <section className="rx-p-card" aria-label="Notes from your doctor">
        <h2>Notes from your doctor</h2>
        <p className="rx-serif rx-p-notes">{p.notes}</p>
      </section>
      <section className="rx-p-card" aria-label="Your medicines">
        <h2>Your medicines</h2>
        <ul className="rx-p-bullets">
          {p.medications.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="rx-p-fine">
          As written at discharge. Ask your care team before changing anything.
        </p>
      </section>
      <section className="rx-p-card" aria-label="What is watched">
        <h2>What your care team watches</h2>
        <p>
          After {p.profile.after}, they compare {list(watching)} with what was
          usual for you before your hospital stay.
        </p>
        <a className="rx-p-rowlink" href="#/patient/watching">
          How a change is judged
          <ChevronRight size={20} aria-hidden="true" />
        </a>
      </section>
      <div className="rx-p-card list">
        <a className="rx-p-rowlink" href="#/patient/connect">
          Connected data and sharing
          <ChevronRight size={20} aria-hidden="true" />
        </a>
        <a className="rx-p-rowlink" href="#/patient/journal">
          Things you recorded
          <ChevronRight size={20} aria-hidden="true" />
        </a>
      </div>
      <button type="button" className="rx-p-btn" onClick={onSignOut}>
        <LogOut size={20} aria-hidden="true" /> Sign out
      </button>
    </>
  );
}

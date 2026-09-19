import { useState } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { openEmergencyAccess } from "../model/careTeam.js";
import "./emergency.css";

// 164.312(a)(2)(ii), emergency access. An account assigned to a care team reaches
// that team's records; any other record is refused by the server. Declaring an
// emergency here is what opens one, for fifteen minutes, under the clinician's name
// and with their reason on the audit chain.
const until = (iso) =>
  new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

// Shown in place of a record the signed-in clinician's team does not cover.
export function OutsideCareTeam({ patient, team }) {
  return (
    <div className="rx-page rx-emergency">
      <section className="rx-card rx-emergency-locked">
        <span className="rx-emergency-icon">
          <LockKeyhole size={20} aria-hidden="true" />
        </span>
        <h1>This record is outside your care team</h1>
        <p>
          {patient.name} is under {patient.hospital}, which is not the team your
          account is for ({team}). The record stays closed. If you need it now,
          declare emergency access: it opens this one record for fifteen minutes
          and is recorded with your name and your reason.
        </p>
        <div className="rx-actions">
          <a
            className="rx-btn primary"
            href={`#/doctor/emergency/${patient.id}`}
          >
            Declare emergency access
          </a>
          <a className="rx-btn" href="#/doctor/watchlist">
            Back to your patients
          </a>
        </div>
      </section>
    </div>
  );
}

export default function EmergencyAccess({ care, cohort, selectedId }) {
  const [patientId, setPatientId] = useState(
    care.outside.some((p) => p.id === selectedId) ? selectedId : "",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameOf = (id) => cohort.find((p) => p.id === id)?.name || id;

  if (!care.scoped)
    return (
      <div className="rx-page rx-emergency">
        <header className="rx-pagehead">
          <div>
            <span className="rx-home-kicker">Emergency access</span>
            <h1>Your account covers the whole ward</h1>
            <p className="rx-emergency-lede">
              Emergency access opens a record outside a clinician&apos;s care
              team. This account is not limited to one team, so there is nothing
              for it to open. An account assigned to a single unit sees only
              that unit&apos;s patients and uses this page for any other record.
            </p>
          </div>
        </header>
      </div>
    );

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await openEmergencyAccess(patientId, reason.trim());
      // The shared log is read from a cursor, so the newly opened record's earlier
      // entries are behind it. Reloading on the record reads it from the start.
      location.hash = `#/doctor/p/${patientId}`;
      location.reload();
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <div className="rx-page rx-emergency">
      <header className="rx-pagehead">
        <div>
          <span className="rx-home-kicker">Emergency access</span>
          <h1>Open a record outside your care team</h1>
          <p className="rx-emergency-lede">
            Your account is for {care.team}. Any other record stays closed
            unless you declare an emergency for it. The declaration opens that
            one record for fifteen minutes and is written to the audit log with
            your name and your reason.
          </p>
        </div>
      </header>

      {care.grants.length > 0 && (
        <section className="rx-card rx-emergency-open" aria-label="Open now">
          <h2>Open now</h2>
          <ul>
            {care.grants.map((g) => (
              <li key={`${g.patientId}-${g.expiresAt}`}>
                <div>
                  <strong>{nameOf(g.patientId)}</strong>
                  <span>
                    Until {until(g.expiresAt)}. Reason given: “{g.reason}”
                  </span>
                </div>
                <a className="rx-btn" href={`#/doctor/p/${g.patientId}`}>
                  Open record
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rx-card" aria-label="Declare emergency access">
        <h2>
          <KeyRound size={17} aria-hidden="true" /> Declare emergency access
        </h2>
        <form className="rx-careteam-form rx-emergency-form" onSubmit={submit}>
          <label htmlFor="rx-emergency-patient">Patient</label>
          <select
            id="rx-emergency-patient"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Choose a patient outside your team</option>
            {care.outside.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.hospital}
              </option>
            ))}
          </select>
          <label htmlFor="rx-emergency-reason">
            Why you need this record now
          </label>
          <textarea
            id="rx-emergency-reason"
            rows="3"
            required
            minLength={10}
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: covering this unit overnight, and the patient has called about their readings."
          />
          <p className="rx-emergency-fine">
            A sentence, not a word. It is kept with the record of this access
            and shown on the Security page while the record is open.
          </p>
          {error && (
            <p className="rx-auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="rx-btn primary"
            disabled={busy || !patientId || reason.trim().length < 10}
          >
            {busy ? "Opening…" : "Open this record for 15 minutes"}
          </button>
        </form>
      </section>
    </div>
  );
}

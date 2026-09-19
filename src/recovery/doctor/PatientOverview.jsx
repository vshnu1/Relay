import { ArrowUp, ChevronDown, ChevronLeft } from "lucide-react";
import { actions, usePatient } from "../useRecovery.js";
import { QUESTIONS } from "../model/profiles.js";
import { ago, clock, dateLong } from "../format.js";
import ModelCard from "./ModelCard.jsx";
import Readings from "./Readings.jsx";
import { exportHandoff } from "./handoff.js";
import CareTeamPanel from "./CareTeamPanel.jsx";
import PatientActivity from "./PatientActivity.jsx";
import ClinicianVoiceSummary from "./ClinicianVoiceSummary.jsx";

export const STATUS = {
  review: "Review recommended",
  context: "Context needed",
  monitoring: "Monitoring",
  nodata: "Not enough data",
};

export default function PatientOverview({ id }) {
  const p = usePatient(id);
  if (!p)
    return (
      <div className="rx-page">
        <p>No patient with that link.</p>
        <a href="#/doctor/watchlist">Back to the watchlist</a>
      </div>
    );
  const twoAgo = p.dayHome - 2;
  const asked = p.answered
    ? (p.questions || p.profile.questions).filter((q) => p.answered.answers[q])
    : [];
  const activeDevices = Object.values(p.devices).filter(
    (d) => d.sharing,
  ).length;
  const totalDevices = Object.values(p.devices).length;
  const strongest = p.moved[0];
  return (
    <div className="rx-page">
      <header className="rx-patienthead">
        <a className="rx-back" href="#/doctor/watchlist">
          <ChevronLeft size={15} /> Watchlist
        </a>
        <div>
          <div>
            <h1>{p.name}</h1>
            <p>
              {p.age} years old. Discharged with {p.profile.after}, day{" "}
              {p.dayHome} of {p.windowDays} at home.
            </p>
          </div>
          <span
            className={`rx-pill ${p.acknowledged ? "monitoring" : p.status}`}
          >
            <i
              className={`rx-glyph ${p.acknowledged ? "monitoring" : p.status}`}
              aria-hidden="true"
            />
            {p.acknowledged ? "Reviewed" : STATUS[p.status]}
          </span>
        </div>
        <dl className="rx-context">
          <div>
            <dt>Discharge pathway</dt>
            <dd>{p.profile.name}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{p.hospital}</dd>
          </div>
          <div>
            <dt>Discharge date</dt>
            <dd>
              {dateLong(p.dischargedAt)} · {p.stayDays}-day stay
            </dd>
          </div>
          <div>
            <dt>Recovery period</dt>
            <dd>
              Day {p.dayHome} of {p.windowDays} · {p.windowDays}-day window
            </dd>
          </div>
          <div>
            <dt>Care lead</dt>
            <dd>{p.clinician}</dd>
          </div>
        </dl>
      </header>

      <div className="rx-patient-summary" aria-label="Patient recovery summary">
        <div className="rx-patient-summary-main">
          <span className="rx-summary-label">At a glance</span>
          <strong>
            {p.pattern
              ? `${p.moved.length} of ${p.counted.length} signals shifted`
              : "Signals are inside the usual range"}
          </strong>
          <span>
            {p.pattern
              ? `For ${p.hours} hours · ${strongest?.name || "multiple signals"} is furthest from usual`
              : "No persistent coordinated change detected"}
          </span>
        </div>
        <div className="rx-patient-summary-stat">
          <strong>{p.pattern ? `${p.hours}h` : "Not available"}</strong>
          <span>Pattern duration</span>
        </div>
        <div className="rx-patient-summary-stat">
          <strong>
            {p.moved.length}/{p.counted.length}
          </strong>
          <span>Signals shifted</span>
        </div>
        <div className="rx-patient-summary-stat">
          <strong>
            {activeDevices}/{totalDevices}
          </strong>
          <span>Devices sharing</span>
        </div>
      </div>

      <ClinicianVoiceSummary patient={p} />

      <div className="rx-overview">
        <section className="rx-card rx-shows" aria-label="What the data shows">
          <div>
            <h2 className="rx-kicker">What the data shows</h2>
            <p className="rx-serif rx-headline">{p.headline}</p>
          </div>
          <dl className="rx-findings">
            {p.findings.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
          <table className="rx-table">
            <thead>
              <tr>
                <th scope="col">Counted for {p.profile.after}</th>
                <th scope="col">Usual</th>
                {twoAgo >= 0 && <th scope="col">Day {twoAgo}</th>}
                <th scope="col">Today</th>
                <th scope="col">Against usual</th>
              </tr>
            </thead>
            <tbody>
              {p.counted.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  <td>{s.fmt(s.usual)}</td>
                  {twoAgo >= 0 && <td>{s.fmt(s.home[twoAgo].v)}</td>}
                  <td>
                    <strong>
                      {s.today === null
                        ? "No reading"
                        : `${s.fmt(s.today)} ${s.unit}`}
                    </strong>
                  </td>
                  <td>
                    <span className={`rx-change ${s.moved ? "moved" : ""}`}>
                      {s.moved && (
                        <ArrowUp
                          size={13}
                          strokeWidth={2.8}
                          style={{
                            transform:
                              s.watchDir < 0 ? "rotate(180deg)" : undefined,
                          }}
                          aria-hidden="true"
                        />
                      )}
                      {s.change}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <a
            className="rx-jump"
            href={`#/doctor/p/${p.id}`}
            onClick={(e) => (
              e.preventDefault(),
              document
                .getElementById("rx-readings")
                ?.scrollIntoView({ behavior: "smooth" })
            )}
          >
            Day-by-day readings are below <ChevronDown size={15} />
          </a>
          <section className="rx-inline-checkin" aria-label="Patient context">
            <div className="rx-inline-checkin-head">
              <div>
                <span className="rx-home-kicker">Patient context</span>
                <h2>
                  {p.answered
                    ? `What ${p.first} reported ${clock(p.answered.answeredAt)}`
                    : "No check-in answered yet"}
                </h2>
              </div>
              {p.pending && (
                <span className="rx-context-pending">
                  Sent {ago(Date.now() - p.pending.requestedAt)}
                </span>
              )}
            </div>
            {p.answered && (
              <div className="rx-inline-checkin-body">
                <dl>
                  {asked.map((q) => (
                    <div key={q}>
                      <dt>{QUESTIONS[q].short}</dt>
                      <dd>{p.answered.answers[q]}</dd>
                    </div>
                  ))}
                </dl>
                {p.answered.note && (
                  <blockquote>“{p.answered.note}”</blockquote>
                )}
              </div>
            )}
          </section>
          <ModelCard patient={p} />
          <PatientActivity patient={p} />
          <details className="rx-followup-details">
            <summary>Contact patient or record follow-up</summary>
            <CareTeamPanel patient={p} embedded />
            <div className="rx-actions rx-review-actions">
              <button
                type="button"
                className="rx-btn primary"
                disabled={p.status !== "review" || p.acknowledged}
                onClick={() => actions.acknowledge(p.id)}
              >
                {p.acknowledged ? "Review acknowledged" : "Acknowledge review"}
              </button>
              <button
                type="button"
                className="rx-btn"
                onClick={() => exportHandoff(p)}
              >
                Export handoff
              </button>
              <button
                type="button"
                className="rx-btn"
                disabled={!!p.pending}
                onClick={() => actions.requestCheckin(p.id)}
              >
                {p.pending ? "Check-in sent" : "Request new check-in"}
              </button>
            </div>
          </details>
        </section>
      </div>

      <Readings patient={p} />
      <p className="rx-fine">
        Hatched areas mark the hospital stay; a short grey tick on the day axis
        marks a day with no reading. Thresholds are demo settings, not
        clinically validated.
      </p>
    </div>
  );
}

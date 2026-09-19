import { ArrowUp, ChevronDown, ChevronLeft } from "lucide-react";
import { actions, usePatient } from "../useRecovery.js";
import { QUESTIONS } from "../model/profiles.js";
import { ago, clock, dateLong, list } from "../format.js";
import Readings from "./Readings.jsx";
import { exportHandoff } from "./handoff.js";

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
        <a href="#/doctor">Back to the watchlist</a>
      </div>
    );
  const twoAgo = p.dayHome - 2;
  const asked = p.answered
    ? (p.questions || p.profile.questions).filter(
        (q) => p.answered.answers[q],
      )
    : [];
  // Read the watched/recorded split straight off the profile, never hardcoded.
  const countedNames = p.counted.map((s) => s.short);
  const recordedNames = p.signals.filter((s) => !s.counted).map((s) => s.short);
  const activeDevices = Object.values(p.devices).filter((d) => d.sharing).length;
  const totalDevices = Object.values(p.devices).length;
  const strongest = p.moved[0];
  return (
    <div className="rx-page">
      <header className="rx-patienthead">
        <a className="rx-back" href="#/doctor">
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
            <dt>Reason for admission</dt>
            <dd>{p.profile.name}</dd>
          </div>
          <div>
            <dt>Discharged with</dt>
            <dd>Home monitoring after {p.profile.after}</dd>
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
            <dt>Monitoring window</dt>
            <dd>
              Day {p.dayHome} of {p.windowDays} · {p.windowDays}-day window
            </dd>
          </div>
          <div>
            <dt>Counted for {p.profile.after}</dt>
            <dd>{list(countedNames)}</dd>
          </div>
          <div>
            <dt>Recorded, not counted</dt>
            <dd>{recordedNames.length ? list(recordedNames) : "None"}</dd>
          </div>
          <div>
            <dt>Consent</dt>
            <dd>On file — agreed before each check-in, since discharge</dd>
          </div>
          <div>
            <dt>Responsible clinician</dt>
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
          <strong>{p.pattern ? `${p.hours}h` : "—"}</strong>
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
        </section>

        <div className="rx-aside">
          <section className="rx-card rx-checkin" aria-label="Check-in">
            {p.answered ? (
              <>
                <h2>
                  What {p.first} told us, {clock(p.answered.answeredAt)}
                </h2>
                <dl>
                  {asked.map((q) => (
                    <div key={q}>
                      <dt>{QUESTIONS[q].short}</dt>
                      <dd>{p.answered.answers[q]}</dd>
                    </div>
                  ))}
                </dl>
                {p.answered.note && (
                  <div className="rx-note">
                    <span>{p.first} also wrote</span>
                    <p className="rx-serif">{p.answered.note}</p>
                  </div>
                )}
              </>
            ) : (
              <h2>No check-in answered yet</h2>
            )}
            {p.pending && (
              <p className="rx-pending">
                Check-in sent {ago(Date.now() - p.pending.requestedAt)}, not
                answered yet.
              </p>
            )}
          </section>
          <div className="rx-actions">
            <button
              type="button"
              className="rx-btn primary tall"
              disabled={p.status !== "review" || p.acknowledged}
              onClick={() => actions.acknowledge(p.id)}
            >
              {p.acknowledged ? "Review acknowledged" : "Acknowledge review"}
            </button>
            <div>
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
                {p.pending
                  ? "Check-in sent"
                  : p.answered
                    ? "Ask again"
                    : "Send check-in"}
              </button>
            </div>
          </div>
          <p className="rx-fine">
            A description of readings against this patient's own baseline. Relay
            does not diagnose or recommend treatment.
          </p>
        </div>
      </div>

      <Readings patient={p} />
      <p className="rx-fine">
        Hatched squares are the hospital stay or a day with no reading.
        Thresholds are demo settings, not clinically validated.
      </p>
    </div>
  );
}

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { dateLong } from "../format.js";
import { STATUS, DETAIL } from "./watchStatus.js";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const ICON = {
  review: CircleAlert,
  context: Clock3,
  nodata: CircleAlert,
  monitoring: CheckCircle2,
};

const SUMMARY = ["review", "context", "nodata", "monitoring"].map((key) => ({
  key,
  title: STATUS[key],
  icon: ICON[key],
  className: key,
  detail: DETAIL[key],
}));

const DESCRIPTIONS = {
  review:
    "Persistent changes are ready for clinician review. Compare the pattern with the patient’s reported context.",
  context:
    "These patients have a check-in waiting. Their reported context will appear in the summary when available.",
  monitoring:
    "These patients have no new persistent pattern in this demo window.",
  nodata:
    "These patients do not have enough recent readings for a reliable comparison.",
};

function PatientRow({ patient }) {
  return (
    <article className="rx-home-patient">
      <div className="rx-home-patient-main">
        <div className="rx-home-patient-title">
          <span className={"rx-glyph " + patient.group} aria-hidden="true" />
          <h3>{patient.name}</h3>
          <span className={"rx-home-status " + patient.group}>
            {STATUS[patient.group]}
          </span>
        </div>
        <p className="rx-home-patient-context">
          {patient.profile.name} · Day {patient.dayHome} of {patient.windowDays}{" "}
          at home
        </p>
        <p className="rx-serif rx-home-patient-finding">{patient.line}</p>
      </div>
      <a className="rx-btn" href={"#/doctor/p/" + patient.id}>
        Open summary <ArrowRight size={15} />
      </a>
    </article>
  );
}

export default function DoctorHome({ cohort }) {
  const counts = Object.fromEntries(
    SUMMARY.map(({ key }) => [
      key,
      cohort.filter((patient) => patient.group === key).length,
    ]),
  );
  const reviewCount = counts.review;
  const [activeGroup, setActiveGroup] = useState(
    () => SUMMARY.find(({ key }) => counts[key] > 0)?.key || "review",
  );
  const selected = SUMMARY.find(({ key }) => key === activeGroup) || SUMMARY[0];
  const visiblePatients = cohort
    .filter((patient) => patient.group === activeGroup)
    .slice(0, 4);

  return (
    <div className="rx-page rx-home">
      <header className="rx-home-hero">
        <div className="rx-home-hero-copy">
          <span className="rx-eyebrow">
            <HeartPulse size={14} /> Clinician workspace ·{" "}
            {dateLong(Date.now())}
          </span>
          <h1>{greeting()}, care team.</h1>
          <p>
            Wearable trends and patient check-ins, together. See what has
            changed since discharge and who needs your attention.
          </p>
          <div className="rx-home-hero-meta">
            <span>
              <ShieldCheck size={15} /> Synthetic records only
            </span>
          </div>
        </div>
        <div className="rx-home-focus">
          <span className="rx-home-focus-icon">
            <FileText size={19} />
          </span>
          <span className="rx-home-focus-label">Start here</span>
          <strong>
            {reviewCount
              ? `${reviewCount} ${reviewCount === 1 ? "patient has" : "patients have"} a persistent change`
              : "Check today’s follow-up queue"}
          </strong>
          <p>
            Open a summary to see the readings behind the flag, what the patient
            reported, and the follow-up actions available to your team.
          </p>
          <a className="rx-btn primary" href="#/doctor/watchlist">
            Review patient queue <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section
        className="rx-home-summary"
        aria-label="Today’s caseload. Select a status to filter the patient list below."
      >
        {SUMMARY.map(({ key, title, icon: Icon, className, detail }) => (
          <button
            className={
              "rx-home-summary-card " +
              className +
              (activeGroup === key ? " active" : "")
            }
            type="button"
            aria-pressed={activeGroup === key}
            id={"rx-home-tab-" + key}
            onClick={() => setActiveGroup(key)}
            key={key}
          >
            <span className="rx-home-summary-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="rx-home-summary-copy">
              <strong>{counts[key]}</strong>
              <span>{title}</span>
              <small>{detail}</small>
            </span>
          </button>
        ))}
      </section>

      <div className="rx-home-queue-layout">
        <section className="rx-home-section" id="rx-home-queue">
          <div className="rx-home-section-head">
            <div>
              <span className="rx-home-kicker">
                Today&apos;s caseload · {counts[activeGroup]}
              </span>
              <h2>{selected.title}</h2>
              <p>{DESCRIPTIONS[activeGroup]}</p>
            </div>
            <a className="rx-home-link" href="#/doctor/watchlist">
              Full recovery watch <ArrowRight size={15} />
            </a>
          </div>
          {visiblePatients.length ? (
            <div className="rx-home-patients">
              {visiblePatients.map((patient) => (
                <PatientRow patient={patient} key={patient.id} />
              ))}
            </div>
          ) : (
            <div className="rx-home-empty">
              <CheckCircle2 size={21} />
              <div>
                <strong>No patients in this category today.</strong>
                <span>
                  Select another status above or open the full recovery watch.
                </span>
              </div>
            </div>
          )}
          {counts[activeGroup] > visiblePatients.length && (
            <p className="rx-home-queue-note">
              Showing {visiblePatients.length} of {counts[activeGroup]}. Open
              the full recovery watch to see everyone.
            </p>
          )}
        </section>
      </div>

      <footer className="rx-home-footnote">
        Synthetic demo · Illustrative thresholds · Clinical decisions stay with
        the care team.
      </footer>
    </div>
  );
}

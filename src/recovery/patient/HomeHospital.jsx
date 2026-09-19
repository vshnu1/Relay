import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  MessageSquare,
  PenLine,
  Pill,
} from "lucide-react";
import { ago, dateLong } from "../format.js";

const when = (t) =>
  new Date(t).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

function Row({ icon: Icon, label, children }) {
  return (
    <div className="rx-ph-hrow">
      <span className="rx-ph-hrow-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <span className="rx-ph-kicker">{label}</span>
        {children}
      </div>
    </div>
  );
}

// The hospital lane: what the care team wrote, one row per kind.
export default function HomeHospital({ patient: p }) {
  const followUp = [...p.appointments]
    .filter((a) => a.t > Date.now())
    .sort((a, b) => a.t - b.t)[0];
  const unread = (p.messages || []).filter(
    (m) => m.by !== "patient" && !m.readAt,
  );
  const latest = [...(p.messages || [])]
    .filter((m) => m.by !== "patient")
    .sort((a, b) => b.t - a.t)[0];
  const [hospital, unit] = p.hospital.split(" — ");
  const daysUntil = followUp
    ? Math.round((followUp.t - Date.now()) / 86400000)
    : null;
  return (
    <section className="rx-ph-lane hospital" aria-label="From your hospital">
      <header className="rx-ph-lane-head">
        <div className="rx-ph-lane-title">
          <span className="rx-ph-lane-icon outline">
            <Building2 size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>From {hospital}</h2>
            <span>
              {unit ? `${unit} · ` : ""}
              {p.clinician}
            </span>
          </div>
        </div>
        {unread.length > 0 && (
          <span className="rx-ph-count">
            {unread.length} new {unread.length === 1 ? "message" : "messages"}
          </span>
        )}
      </header>

      <div className="rx-ph-hrows">
        <Row icon={FileText} label="Discharge">
          <strong>
            {dateLong(p.dischargedAt)} · after a {p.stayDays}-day stay
          </strong>
          <span>
            Home for {p.windowDays} days of watching. Responsible clinician:{" "}
            {p.clinician}.
          </span>
        </Row>
        <Row icon={PenLine} label="Doctor's notes">
          {p.notes ? (
            <p className="rx-serif rx-ph-notes">{p.notes}</p>
          ) : (
            <span className="rx-p-empty">
              Not written yet. They appear here when your care team adds them.
            </span>
          )}
        </Row>
        <Row icon={Pill} label="Prescriptions">
          {p.medications.length ? (
            <ul className="rx-ph-meds">
              {p.medications.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <span className="rx-p-empty">None listed yet.</span>
          )}
        </Row>
        <Row icon={CalendarDays} label="Next follow-up">
          {followUp ? (
            <>
              <strong>
                {when(followUp.t)}
                {daysUntil > 0 &&
                  ` · in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`}
              </strong>
              <span>
                {followUp.with} · {followUp.where}
              </span>
            </>
          ) : (
            <span className="rx-p-empty">Not scheduled yet.</span>
          )}
        </Row>
        <Row icon={MessageSquare} label="Message">
          {latest ? (
            <>
              <strong>
                {latest.from} · {ago(Date.now() - latest.t)}
                {!latest.readAt && (
                  <i className="rx-ph-dot" aria-label="unread" />
                )}
              </strong>
              <span>“{latest.text}”</span>
            </>
          ) : (
            <span className="rx-p-empty">No messages yet.</span>
          )}
        </Row>
      </div>

      <a className="rx-ph-lane-foot" href="#/patient/care">
        Messages, appointments and send a report
        <ChevronRight size={16} aria-hidden="true" />
      </a>
    </section>
  );
}

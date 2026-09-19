import { ChevronRight, CheckCircle2, Mic, Search } from "lucide-react";
import { checkinDue, checkinWhy, notifications } from "../model/schedule.js";

// What the patient must attend to, in order. One banner when something unusual
// was found (an off-schedule check-in, a request from the care team, or the
// model recommending a report); a calm card for a routine check-in; a quiet
// line otherwise. Anything else the schedule raises follows as small rows.
export default function HomeAlert({ patient: p }) {
  const notes = notifications(p);
  const due = checkinDue(p);
  const checkin = notes.find((n) => n.id === "checkin");
  const report = notes.find((n) => n.id === "report");
  const rest = notes.filter((n) => n.id !== "checkin" && n.id !== "report");
  const unusual = (checkin && due.reason !== "scheduled") || report;

  return (
    <>
      {unusual ? (
        <section className="rx-ph-banner unusual" role="alert">
          <span className="rx-ph-banner-icon">
            <Search size={22} aria-hidden="true" />
          </span>
          <div>
            <span className="rx-ph-kicker">
              {checkin
                ? due.reason === "asked"
                  ? "Check in now · your care team asked"
                  : "Check in now · not your scheduled day"
                : "Report recommended"}
            </span>
            <strong>Something unusual was found in your readings</strong>
            <p>{checkin ? checkinWhy(p) : report.body}</p>
          </div>
          <div className="rx-ph-banner-actions">
            <a
              className="rx-ph-btn ghost"
              href={
                report || p.analysis
                  ? "#/patient/insight"
                  : "#/patient/readings"
              }
            >
              See what changed
            </a>
            <a
              className="rx-ph-btn primary"
              href={checkin ? "#/patient/checkin" : "#/patient/insight"}
            >
              {checkin ? "Check in now" : "See what this means"}
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      ) : checkin ? (
        <section className="rx-ph-banner routine">
          <span className="rx-ph-banner-icon">
            <Mic size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{checkin.title}</strong>
            <p>{checkin.body}</p>
          </div>
          <div className="rx-ph-banner-actions">
            <a className="rx-ph-btn primary" href={checkin.href}>
              {checkin.cta}
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      ) : (
        <p className="rx-ph-quiet">
          <CheckCircle2 size={16} aria-hidden="true" /> Nothing is needed from
          you today. Your care team can see your readings.
        </p>
      )}
      {rest.length > 0 && (
        <div className="rx-ph-rows" aria-label="Also today">
          {rest.map((n) => (
            <a key={n.id} className="rx-ph-row" href={n.href}>
              <span>
                <strong>{n.title}</strong> {n.body}
              </span>
              <span className="rx-ph-row-cta">
                {n.cta} <ChevronRight size={14} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

import { ChevronRight, CheckCircle2, Mic, Search } from "lucide-react";
import { checkinDue, checkinWhy, notifications } from "../model/schedule.js";
import { ago, list } from "../format.js";

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
  // Already answered and reported, but the readings are still away from the
  // usual: say so, as a status rather than a task, so the top of the page
  // never goes quiet while the model below says "unusual".
  const modelUnusual = ["review_recommended", "context_needed"].includes(
    p.analysis?.application_state,
  );
  const reviewing =
    !unusual && !checkin && p.answered && (modelUnusual || p.pattern);
  const lastReport = [...(p.reports || [])].sort(
    (a, b) => b.sentAt - a.sentAt,
  )[0];
  const moved = p.counted
    .filter((s) => s.moved)
    .map((s) => s.plain.toLowerCase());
  const sentence = (items) => {
    const t = list(items);
    return t[0].toUpperCase() + t.slice(1);
  };

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
      ) : reviewing ? (
        <section className="rx-ph-banner reviewing">
          <span className="rx-ph-banner-icon">
            <Search size={20} aria-hidden="true" />
          </span>
          <div>
            <span className="rx-ph-kicker">
              Under review · you checked in{" "}
              {ago(Date.now() - p.answered.answeredAt)}
              {lastReport
                ? ` and sent a report ${ago(Date.now() - lastReport.sentAt)}`
                : ""}
            </span>
            <strong>Something unusual was found in your readings</strong>
            <p>
              {moved.length
                ? `${sentence(moved)} ${moved.length === 1 ? "is" : "are"} away from your usual${p.hours ? ` for about ${p.hours} hours` : ""}.`
                : "Relay's model found a pattern away from your usual."}{" "}
              Your care team has your answers
              {lastReport ? " and your report" : ""}. Nothing more is needed
              from you unless you feel worse.
            </p>
          </div>
          <div className="rx-ph-banner-actions">
            <a className="rx-ph-btn ghost" href="#/patient/insight">
              What this means
            </a>
            <a className="rx-ph-btn primary" href="#/patient/care">
              Message care team
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

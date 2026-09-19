import { ChevronRight, CheckCircle2, Mic } from "lucide-react";
import { checkinDue, notifications } from "../model/schedule.js";
import { ago, list } from "../format.js";

// The alert at the top of the home: one kicker, one line, one short sentence,
// and one button to check in with Relay's agent.
//   1. First alert: readings moved, no check-in for this change yet. Relay
//      asks a few questions to find the likely cause.
//   2. Worsening: the readings stayed away after that check-in. Relay offers
//      another focused conversation so the patient can update their care team.
//   3. Under review: answered and reported; talk to Relay if anything changed.
// A routine check-in is a calm card; otherwise a quiet line. No icon.
export default function HomeAlert({ patient: p }) {
  const notes = notifications(p);
  const due = checkinDue(p);
  const checkin = notes.find((n) => n.id === "checkin");
  const report = notes.find((n) => n.id === "report");
  // Unread messages have their own banner at the top of Home (HomeMessages.jsx), so
  // they are left out here rather than shown twice.
  const rest = notes.filter(
    (n) => n.id !== "checkin" && n.id !== "report" && !n.id.startsWith("msg-"),
  );
  const unusual = (checkin && due.reason !== "scheduled") || report;
  const modelUnusual = ["review_recommended", "context_needed"].includes(
    p.analysis?.application_state,
  );
  const reviewing =
    !unusual && !checkin && p.answered && (modelUnusual || p.pattern);
  const priorPriority = p.checkins.some(
    (c) => c.answeredAt && c.kind === "priority",
  );
  const worsening =
    unusual &&
    (report ||
      (priorPriority &&
        p.analysis?.application_state === "review_recommended"));
  const moved = p.counted
    .filter((s) => s.moved)
    .map((s) => s.plain.toLowerCase());
  const sentence = (items) => {
    const t = list(items);
    return t[0].toUpperCase() + t.slice(1);
  };
  const span = p.hours ? ` for about ${p.hours} hours` : "";
  const what =
    moved.length > 2
      ? `${moved.length} of ${p.counted.length} readings have moved away from your usual${span}.`
      : moved.length
        ? `${sentence(moved)} ${moved.length === 1 ? "has" : "have"} moved away from your usual${span}.`
        : "Relay's model found a pattern away from your usual.";

  const actions = (label) => (
    <div className="rx-ph-banner-actions">
      <a className="rx-ph-btn primary small" href="#/patient/checkin">
        {label}
        <ChevronRight size={14} aria-hidden="true" />
      </a>
    </div>
  );

  return (
    <>
      {unusual ? (
        <section
          className={`rx-ph-banner unusual noicon ${worsening ? "worsening" : ""}`}
          role="alert"
        >
          <div>
            <span className="rx-ph-kicker">
              {due.reason === "asked"
                ? "Alert · your care team asked for a check-in"
                : worsening
                  ? "Alert · your readings have not settled"
                  : "Alert · something changed in your readings"}
            </span>
            <strong>
              {worsening
                ? "Your readings have not settled since your last check-in"
                : "Something changed in your readings"}
            </strong>
            <p>
              {what}{" "}
              {worsening
                ? report
                  ? "Your check-in is with your care team. Talk to Relay again if anything has changed."
                  : "Relay will run a short alert check-in; afterwards you can send it to your nurse."
                : "Often a simple cause: exercise, a meal, a poor night. Relay will ask you a few questions to find it."}
            </p>
          </div>
          {actions(worsening ? "Alert check-in" : "Check in")}
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
        <section className="rx-ph-banner reviewing noicon">
          <div>
            <span className="rx-ph-kicker">
              Under review · checked in{" "}
              {ago(Date.now() - p.answered.answeredAt)}
            </span>
            <strong>Something unusual is still in your readings</strong>
            <p>
              {what} Your care team has your check-in. Talk to Relay if anything
              has changed.
            </p>
          </div>
          {actions("Check in")}
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

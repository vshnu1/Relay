import { ChevronRight, CheckCircle2, Mic } from "lucide-react";
import { checkinDue, notifications } from "../model/schedule.js";
import { ago, list } from "../format.js";

// The alert at the top of the home, written as what this means and what Relay
// will do next. Three stages:
//   1. First alert: readings moved, no check-in for this change yet. Relay
//      checks in to find the likely cause (exercise, a meal, a bad night).
//   2. Worsening: the readings stayed away after that check-in. Relay runs an
//      alert check-in; afterwards the result can go to the nurse.
//   3. Under review: answered and reported; nothing more unless they feel worse.
// A routine check-in is a calm card; otherwise a quiet line. No icon on the
// alert: it is a message, not a widget.
export default function HomeAlert({ patient: p }) {
  const notes = notifications(p);
  const due = checkinDue(p);
  const checkin = notes.find((n) => n.id === "checkin");
  const report = notes.find((n) => n.id === "report");
  const rest = notes.filter((n) => n.id !== "checkin" && n.id !== "report");
  const unusual = (checkin && due.reason !== "scheduled") || report;
  const modelUnusual = ["review_recommended", "context_needed"].includes(
    p.analysis?.application_state,
  );
  const reviewing =
    !unusual && !checkin && p.answered && (modelUnusual || p.pattern);
  const lastReport = [...(p.reports || [])].sort(
    (a, b) => b.sentAt - a.sentAt,
  )[0];
  // A priority check-in already answered for this change means the readings
  // did not settle: the next one is an alert check-in, not a first look.
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
  const what = moved.length
    ? `${sentence(moved)} ${moved.length === 1 ? "has" : "have"} moved away from your usual${p.hours ? ` for about ${p.hours} hours` : ""}.`
    : "Relay's model found a pattern in your readings that is away from your usual.";

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
                ? "Your care team asked for a check-in"
                : worsening
                  ? "Alert · your readings have not settled"
                  : "Alert · something changed in your readings"}
            </span>
            <strong>
              {worsening
                ? "Your readings have stayed away from your usual since your last check-in"
                : "What this means"}
            </strong>
            <p>
              {what}{" "}
              {worsening
                ? report
                  ? "Your alert check-in is done and the answers do not explain the change. You can send the result to your nurse now; they read it during working hours."
                  : "Relay will run an alert check-in with you now. When it is done you can send the result to your nurse."
                : "A change like this can have a simple cause: exercise, a big meal, alcohol, a poor night, a missed medicine. Relay will check in with you now to find the likely cause, so your care team can tell an ordinary day from a real change. About two minutes, by voice."}
            </p>
          </div>
          <div className="rx-ph-banner-actions">
            <a className="rx-ph-btn ghost" href="#/patient/readings">
              See what changed
            </a>
            {report ? (
              <a className="rx-ph-btn primary" href="#/patient/insight">
                Send to my nurse
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            ) : (
              <a className="rx-ph-btn primary" href="#/patient/checkin">
                {worsening ? "Start alert check-in" : "Check in now"}
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            )}
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
        <section className="rx-ph-banner reviewing noicon">
          <div>
            <span className="rx-ph-kicker">
              Under review · you checked in{" "}
              {ago(Date.now() - p.answered.answeredAt)}
              {lastReport
                ? ` and sent it to your nurse ${ago(Date.now() - lastReport.sentAt)}`
                : ""}
            </span>
            <strong>What this means</strong>
            <p>
              {what} Your care team has your answers
              {lastReport ? " and your report" : ""}. If the readings do not
              settle, Relay will run an alert check-in with you. Nothing more is
              needed unless you feel worse.
            </p>
          </div>
          <div className="rx-ph-banner-actions">
            <a className="rx-ph-btn ghost" href="#/patient/insight">
              Full picture
            </a>
            <a className="rx-ph-btn primary" href="#/patient/care">
              Message my nurse
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

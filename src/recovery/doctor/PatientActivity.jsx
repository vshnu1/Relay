import { useState } from "react";
import {
  BookOpen,
  Brain,
  ClipboardList,
  FileText,
  PenLine,
  Smartphone,
} from "lucide-react";
import { QUESTIONS, SIGNALS } from "../model/profiles.js";
import { ago, clock } from "../format.js";

// Everything the patient did, newest first: check-ins answered, reports sent,
// what they recorded, readings they entered, imports, and the model's result
// they were shown. It is the same event log the patient's app writes, so it
// updates while the clinician watches. A report opens in full.
const DAY = 86400000;

// The same words the model card uses, so one page does not name a state two
// ways, and the same two decimals, so it does not round it two ways either.
const STATE_WORDS = {
  monitoring: "nothing unusual",
  context_needed: "unusual, context needed",
  review_recommended: "unusual, ready for review",
  insufficient_data: "cannot see enough",
};

function build(p) {
  const items = [];
  for (const c of p.checkins)
    if (c.answeredAt)
      items.push({
        t: c.answeredAt,
        kind: "checkin",
        icon: ClipboardList,
        title: "Check-in answered",
        text: (p.questions || p.profile.questions)
          .filter((q) => c.answers[q])
          .map((q) => `${QUESTIONS[q].short}: ${c.answers[q]}`)
          .join(" · "),
        note: c.note,
      });
  for (const r of p.reports || [])
    items.push({
      t: r.sentAt,
      kind: "report",
      icon: FileText,
      title: "Report sent by the patient",
      text: r.reason || r.subject,
      body: r.body,
    });
  for (const j of p.journal || [])
    items.push({
      t: j.t,
      kind: "journal",
      icon: BookOpen,
      title: `Recorded: ${j.kind}`,
      text: j.text,
    });
  for (const s of p.signals)
    if (SIGNALS[s.id].device === "manual")
      for (const r of (p.readings[s.id] || []).slice(-5))
        items.push({
          t: r.t,
          kind: "manual",
          icon: PenLine,
          title: `${s.name} entered by hand`,
          text: `${s.fmt(r.v)} ${s.unit}`,
        });
  const phone = p.devices.phone;
  if (phone?.imports)
    items.push({
      t: phone.lastSync,
      kind: "import",
      icon: Smartphone,
      title: "Health app export imported",
      text: `${phone.imports} import${phone.imports === 1 ? "" : "s"}; readings before admission set the baseline.`,
    });
  if (p.analysis?.at)
    items.push({
      t: p.analysis.at,
      kind: "model",
      icon: Brain,
      title: `Model scored: ${STATE_WORDS[p.analysis.application_state] || p.analysis.application_state.replace(/_/g, " ")}`,
      text: `Anomaly score ${typeof p.analysis.anomaly_score === "number" ? p.analysis.anomaly_score.toFixed(2) : "not available"}, ${p.analysis.withContext ? "with the patient's answers" : "readings only"}.`,
    });
  return items.sort((a, b) => b.t - a.t);
}

export default function PatientActivity({ patient: p }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const items = build(p);
  const shown = showAll ? items : items.slice(0, 8);
  const answered = p.checkins.filter((c) => c.answeredAt).length;
  const reports = (p.reports || []).length;
  const week = items.filter((i) => Date.now() - i.t < 7 * DAY).length;
  const last = items[0];
  return (
    <section className="rx-activity" aria-label="Patient activity">
      <div className="rx-inline-checkin-head">
        <div>
          <span className="rx-home-kicker">Patient activity</span>
          <h2>
            {last
              ? `Last activity ${ago(Date.now() - last.t)}`
              : "Nothing from the patient yet"}
          </h2>
        </div>
        <span className="rx-activity-stats">
          {answered} check-in{answered === 1 ? "" : "s"} · {reports} report
          {reports === 1 ? "" : "s"} · {week} in the last seven days
        </span>
      </div>
      {items.length > 0 && (
        <ol className="rx-activity-list">
          {shown.map((i, n) => (
            <li key={`${i.kind}-${i.t}-${n}`} className={i.kind}>
              <i.icon size={15} aria-hidden="true" />
              <div>
                <div className="rx-activity-row">
                  <strong>{i.title}</strong>
                  <time dateTime={new Date(i.t).toISOString()}>
                    {clock(i.t)}
                  </time>
                </div>
                {i.text && <p>{i.text}</p>}
                {i.note && <blockquote>“{i.note}”</blockquote>}
                {i.body && (
                  <>
                    <button
                      type="button"
                      className="rx-textbtn"
                      aria-expanded={open === i.t}
                      onClick={() => setOpen(open === i.t ? null : i.t)}
                    >
                      {open === i.t ? "Hide the report" : "Read the report"}
                    </button>
                    {open === i.t && (
                      <pre className="rx-activity-report">{i.body}</pre>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {items.length > 8 && (
        <button
          type="button"
          className="rx-textbtn"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

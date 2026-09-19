import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { insight, concerningReports } from "../model/schedule.js";
import { SendReport } from "./Care.jsx";
import { QUESTIONS } from "../model/profiles.js";
import { clock, list } from "../format.js";

// What the last check-in means, in plain words, with the one action that follows.
export default function Insight({ patient: p }) {
  const [sending, setSending] = useState(false);
  const i = insight(p);
  const reports = concerningReports(p.answered);
  const moved = p.moved;
  return (
    <>
      <a className="rx-p-back" href="#/patient">
        <ChevronLeft size={20} /> Home
      </a>
      <h1 className="rx-p-title">What this means for you</h1>
      <section
        className={`rx-p-card rx-p-insight ${i.level}`}
        aria-label="Insight"
      >
        <span className="rx-p-eyebrow">
          {i.level === "send"
            ? "Recommended action"
            : i.level === "explained"
              ? "Likely explained"
              : i.level === "watch"
                ? "Keep an eye on it"
                : "All clear today"}
        </span>
        <h2>{i.title}</h2>
        <p>{i.body}</p>
        {i.send && (
          <button
            type="button"
            className="rx-p-btn primary"
            onClick={() => setSending(true)}
          >
            Send the report to my care team
          </button>
        )}
      </section>
      <section className="rx-p-card list" aria-label="What we looked at">
        <h2>What we looked at</h2>
        <div className="rx-p-entryrow">
          <span>Your readings</span>
          <p>
            {moved.length
              ? `${list(moved.map((s) => s.plain.toLowerCase()))} ${moved.length === 1 ? "has" : "have"} been away from your usual for ${p.hours} hours.`
              : "All of them are inside your usual range."}
          </p>
        </div>
        {p.answered && (
          <div className="rx-p-entryrow">
            <span>Your answers, {clock(p.answered.answeredAt)}</span>
            <p>
              {reports.length
                ? `You reported ${list(reports)}.`
                : "Nothing you reported raises a concern."}
              {p.answered.answers.activity === "Yes"
                ? " You were more active than usual."
                : ""}
              {p.answered.answers.medicine === "Yes"
                ? " You missed medicines."
                : ""}
            </p>
            <details>
              <summary>All answers</summary>
              <ul className="rx-p-bullets">
                {p.profile.questions
                  .filter((q) => p.answered.answers[q])
                  .map((q) => (
                    <li key={q}>
                      {QUESTIONS[q].short}:{" "}
                      <strong>{p.answered.answers[q]}</strong>
                    </li>
                  ))}
              </ul>
            </details>
          </div>
        )}
      </section>
      <a className="rx-p-rowlink" href="#/patient/readings">
        See the readings behind this
        <ChevronRight size={20} aria-hidden="true" />
      </a>
      <p className="rx-p-fine">
        This describes your readings against your own usual. It is not a
        diagnosis. If you feel very unwell, follow the emergency instructions in
        your discharge papers.
      </p>
      {sending && (
        <SendReport
          patient={p}
          reason={i.body}
          onDone={() => setSending(false)}
        />
      )}
    </>
  );
}

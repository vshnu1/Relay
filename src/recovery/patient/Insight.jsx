import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { insight, concerningReports } from "../model/schedule.js";
import { SendReport } from "./Care.jsx";
import { useAnalysis } from "./useAnalysis.js";
import { describeAnalysis, plainMetric } from "../model/mlClient.js";

// Six-hour windows are how the model counts; hours are how a person does.
const hoursWord = (h) =>
  h < 24
    ? `${h} hours`
    : `${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? "day" : "days"}`;
import { QUESTIONS } from "../model/profiles.js";
import { clock, list } from "../format.js";

// What the last check-in means, in plain words, with the one action that follows.
export default function Insight({ patient: p }) {
  const [sending, setSending] = useState(false);
  const { run, busy, error } = useAnalysis(p);
  const i = insight(p);
  const a = p.analysis;
  let voiceRec = null;
  try {
    voiceRec = JSON.parse(
      sessionStorage.getItem("rx-voice-recommendation") || "null",
    );
  } catch {
    voiceRec = null;
  }
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
        {voiceRec && (
          <p className="rx-p-fine">
            Relay's voice assistant suggested:{" "}
            {voiceRec.action === "send_report"
              ? "send a report"
              : "message your care team"}
            . {voiceRec.reason}
          </p>
        )}
        {(i.send || voiceRec?.action === "send_report") && (
          <button
            type="button"
            className="rx-p-btn primary"
            onClick={() => setSending(true)}
          >
            Send the report to my care team
          </button>
        )}
        {voiceRec?.action === "message_care_team" && (
          <a className="rx-p-btn" href="#/patient/care">
            Message my care team
          </a>
        )}
      </section>
      <section className="rx-p-card list" aria-label="Relay's model">
        <h2>Relay's model</h2>
        {a ? (
          <>
            <p>{describeAnalysis(a, p.profile)}</p>
            {/* This used to print the raw state, an unrounded 0-1 score, the
                data-quality enum and the model version. That is a debug line,
                and it sat directly under the one plain sentence the card
                exists to give. The score is expressed the way every other
                patient screen expresses it. */}
            <p className="rx-p-fine">
              {typeof a.anomaly_score === "number"
                ? `Scored ${Math.round(a.anomaly_score * 100)} out of 100`
                : "Not scored"}{" "}
              · {a.withContext ? "using your answers too" : "readings only"}
            </p>
            {a.contributors?.length > 0 && (
              <ul className="rx-p-bullets">
                {a.contributors.slice(0, 4).map((c) => (
                  <li key={c.metric}>
                    {plainMetric(c)} is{" "}
                    {c.direction === "above_baseline" ? "higher" : "lower"} than
                    your usual
                    {c.persistence_windows
                      ? `, and has been for ${hoursWord(c.persistence_windows * 6)}`
                      : ""}
                    .
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>The model has not scored your readings yet.</p>
        )}
        {error && (
          <p className="rx-p-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="rx-p-btn small"
          disabled={busy}
          onClick={() => run(p.answered ? p.answered.answers : null)}
        >
          {busy ? "Scoring…" : a ? "Score again" : "Score my readings"}
        </button>
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

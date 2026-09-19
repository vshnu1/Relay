import { useState } from "react";
import { CalendarDays, CheckCircle2, Mail, MessageSquare } from "lucide-react";
import { actions } from "../useRecovery.js";
import { buildReport, mailto, insight } from "../model/schedule.js";
import { clock } from "../format.js";

// Sending a report is the patient's decision, every time. Relay prepares it and
// opens an email draft; nothing is sent by itself.
export function SendReport({ patient: p, reason, onDone }) {
  const [phase, setPhase] = useState("confirm");
  const report = buildReport(p);
  const sendNow = () => {
    actions.recordReport(p.id, {
      to: report.to,
      subject: report.subject,
      method: "in-app",
      body: report.body,
      reason,
    });
    setPhase("sent");
  };
  if (phase === "sent")
    return (
      <div className="rx-p-card">
        <p className="rx-p-sent">
          <span>
            <CheckCircle2 size={22} aria-hidden="true" /> Sent to your care team
          </span>
        </p>
        <p>
          {p.clinician} can read it in Relay now, with your readings and your
          answers. Sent {clock(Date.now())}.
        </p>
        <div className="rx-p-stack">
          <button type="button" className="rx-p-btn primary" onClick={onDone}>
            Done
          </button>
          <a className="rx-p-textbtn" href={mailto(report)}>
            Also open it as an email
          </a>
        </div>
      </div>
    );
  if (phase === "preview")
    return (
      <div className="rx-p-card">
        <h2>The report</h2>
        <pre className="rx-p-report">{report.body}</pre>
        <div className="rx-p-stack">
          <button type="button" className="rx-p-btn primary" onClick={sendNow}>
            <Mail size={20} aria-hidden="true" /> Send to my care team
          </button>
          <button
            type="button"
            className="rx-p-textbtn"
            onClick={() => setPhase("confirm")}
          >
            Back
          </button>
        </div>
      </div>
    );
  return (
    <div
      className="rx-p-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Send a report"
    >
      <div className="rx-p-sheet-body">
        <Mail size={34} aria-hidden="true" />
        <h2>Send this report to your care team?</h2>
        <p>{reason}</p>
        <p>
          It goes to <strong>{p.clinician}</strong> at {p.hospital}, inside
          Relay, with today's readings, your answers, and anything you recorded.
          Nothing is sent until you confirm on the next screen.
        </p>
        <div className="rx-p-stack">
          <button
            type="button"
            className="rx-p-btn primary"
            onClick={() => setPhase("preview")}
          >
            Yes, show me the report
          </button>
          <button type="button" className="rx-p-btn" onClick={onDone}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Care({ patient: p }) {
  const [sending, setSending] = useState(false);
  const i = insight(p);
  const upcoming = [...p.appointments]
    .filter((a) => a.t > Date.now())
    .sort((a, b) => a.t - b.t);
  const messages = [...p.messages].reverse();
  return (
    <>
      <h1 className="rx-p-title">Your care team</h1>
      <p className="rx-p-lead">
        {p.clinician} at {p.hospital}. They see your readings and answers during
        working hours.
      </p>
      <section className="rx-p-card list" aria-label="Appointments">
        <h2>
          <CalendarDays size={20} aria-hidden="true" /> Appointments
        </h2>
        {upcoming.length ? (
          upcoming.map((a) => (
            <div key={a.t} className="rx-p-entryrow">
              <span>
                {new Date(a.t).toLocaleString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <p>
                <strong>{a.with}</strong>
                <br />
                {a.where}
              </p>
            </div>
          ))
        ) : (
          <p>No appointments booked yet. Your care team will add them here.</p>
        )}
      </section>
      <section
        className="rx-p-card list"
        aria-label="Messages from your care team"
      >
        <h2>
          <MessageSquare size={20} aria-hidden="true" /> From your care team
        </h2>
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.t}
              className={`rx-p-entryrow ${m.readAt ? "" : "unread"}`}
            >
              <span>
                {clock(m.t)} · {m.from}
              </span>
              <p className="rx-serif">{m.text}</p>
              {!m.readAt && (
                <button
                  type="button"
                  className="rx-p-textbtn"
                  onClick={() => actions.markRead(p.id, m.t)}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No messages yet.</p>
        )}
      </section>
      <section
        className={`rx-p-card ${i.send ? "alert" : ""}`}
        aria-label="Send a report"
      >
        <h2>
          <Mail size={20} aria-hidden="true" /> Send a report
        </h2>
        <p>
          {i.send
            ? "Your readings and your answers point the same way. We recommend sending a report now."
            : "You can send your readings, answers and notes to your care team at any time."}
        </p>
        {p.reports.length > 0 && (
          <small className="rx-p-fine">
            Last sent {clock(p.reports[p.reports.length - 1].sentAt)}.
          </small>
        )}
        <button
          type="button"
          className={`rx-p-btn ${i.send ? "primary" : ""}`}
          onClick={() => setSending(true)}
        >
          Send a report
        </button>
      </section>
      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers. Do not wait for a reply here.
      </p>
      {sending && (
        <SendReport
          patient={p}
          reason={i.send ? i.body : "You chose to send a report."}
          onDone={() => setSending(false)}
        />
      )}
    </>
  );
}

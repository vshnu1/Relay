import { useState } from "react";
import { CheckCircle2, Mail, MessageSquare, Send } from "lucide-react";
import { actions } from "../useRecovery.js";
import { buildReport, mailto } from "../model/schedule.js";
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
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const messages = [...p.messages].reverse();
  return (
    <>
      <h1 className="rx-p-title">Your care team</h1>
      <p className="rx-p-lead">
        {p.clinician} at {p.hospital}. They see your readings and answers during
        working hours.
      </p>
      <section
        className="rx-p-card list"
        aria-label="Messages with your care team"
      >
        <h2>
          <MessageSquare size={20} aria-hidden="true" /> Messages
        </h2>
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.t}
              className={`rx-p-entryrow ${m.by === "patient" ? "outbound" : m.readAt ? "" : "unread"}`}
            >
              <span>
                {clock(m.t)} · {m.by === "patient" ? "You" : m.from}
              </span>
              <p className="rx-serif">{m.text}</p>
              {m.by !== "patient" && !m.readAt && (
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
          <p>No messages yet. You can start a conversation below.</p>
        )}
      </section>
      <form
        className="rx-p-card rx-p-message-compose"
        aria-label="Message your care team"
        onSubmit={(event) => {
          event.preventDefault();
          const text = messageDraft.trim();
          if (!text) return;
          actions.sendMessage(p.id, {
            by: "patient",
            from: p.name || p.first || "You",
            text,
          });
          setMessageDraft("");
          setMessageSent(true);
        }}
      >
        <h2>
          <MessageSquare size={20} aria-hidden="true" /> Message your care team
        </h2>
        <p>
          Send a message to {p.clinician}. Your care team will reply during
          working hours.
        </p>
        <label className="rx-p-message-label" htmlFor="care-team-message">
          Your message
        </label>
        <textarea
          id="care-team-message"
          value={messageDraft}
          maxLength={500}
          rows={4}
          placeholder="What would you like your care team to know?"
          onChange={(event) => {
            setMessageDraft(event.target.value);
            setMessageSent(false);
          }}
        />
        <div className="rx-p-message-actions">
          <small className="rx-p-fine" aria-live="polite">
            {messageSent ? "Message sent to your care team." : `${messageDraft.length}/500`}
          </small>
          <button
            type="submit"
            className="rx-p-btn primary"
            disabled={!messageDraft.trim()}
          >
            <Send size={17} aria-hidden="true" /> Send message
          </button>
        </div>
      </form>
      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers. Do not wait for a reply here.
      </p>
    </>
  );
}

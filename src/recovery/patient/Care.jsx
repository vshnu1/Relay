import Conversation from "../Conversation.jsx";
import { useState } from "react";
import { CheckCircle2, Mail, MessageSquare } from "lucide-react";
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
  return (
    <>
      <h1 className="rx-p-title">Your care team</h1>
      <p className="rx-p-lead">
        {p.clinician} at {p.hospital}. They see your readings and answers during
        working hours.
      </p>
      <section className="rx-p-card" aria-label="Messages with your care team">
        <h2>
          <MessageSquare size={20} aria-hidden="true" /> Messages
        </h2>
        <Conversation patient={p} side="patient" />
      </section>
      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers. Do not wait for a reply here.
      </p>
    </>
  );
}

import { useEffect, useState } from "react";
import {
  Activity,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const ACTION = {
  "record.view": "Opened a patient record",
  "roster.view": "Listed the ward",
  "recovery.read": "Read a recovery log",
  "recovery.events": "Wrote to a record",
  "consent.changed": "Consent changed",
  "review.acknowledged": "Acknowledged a review",
  "handoff.exported": "Exported a handoff",
  "dataset.imported": "Imported readings",
  "checkin.voice.started": "Started a voice check-in",
  "checkin.recorded": "Recorded a check-in",
  "ml.guard": "Model output checked by the language guard",
  "ml.scored": "Scored a patient's readings",
  "analysis.run": "Ran the analysis",
  "simulation.run": "Ran a simulation",
  "clinician.voice_summary.generated": "Spoke a clinician summary",
};

function AuditTrail() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const headers = {};
    try {
      const code = sessionStorage.getItem("rx-code");
      if (code) headers.authorization = `Bearer ${code}`;
    } catch {
      // no session storage
    }
    fetch("/api/audit", { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(
        (list) => live && setRows(Array.isArray(list) ? list.slice(0, 8) : []),
      )
      .catch(() => live && setError("The audit log could not be read."));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p className="rx-model-fine">{error}</p>;
  if (!rows) return <p className="rx-model-fine">Reading the audit log…</p>;
  if (!rows.length)
    return <p className="rx-model-fine">Nothing has been accessed yet.</p>;

  return (
    <ul className="rx-audit-list">
      {rows.map((r) => (
        <li key={r.id}>
          <span className={`rx-audit-actor ${r.actor}`}>{r.actor}</span>
          <span className="rx-audit-what">
            {ACTION[r.action] || r.action}
            {r.patientId ? ` · ${r.patientId}` : ""}
          </span>
          <time dateTime={r.at}>{ago(r.at)}</time>
        </li>
      ))}
    </ul>
  );
}

export default function Assurance() {
  return (
    <div className="rx-page rx-assurance">
      <header className="rx-pagehead">
        <div>
          <span className="rx-home-kicker">Security overview</span>
          <h1>Built with privacy in mind</h1>
          <p className="rx-assurance-sub">
            Relay demonstrates safeguards for a recovery-monitoring workflow.
            This workspace uses synthetic records and is not a production
            clinical system or a compliance certification.
          </p>
        </div>
      </header>

      <section className="rx-assurance-points" aria-label="Security features">
        <article className="rx-assurance-point">
          <span>
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <h3>Role-based access</h3>
          <p>
            Patient and clinician views are separated and access codes are
            verified by the server.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <Activity size={18} aria-hidden="true" />
          </span>
          <h3>Automatic sign-out</h3>
          <p>Inactive sessions expire, with a warning before sign-out.</p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <ClipboardCheck size={18} aria-hidden="true" />
          </span>
          <h3>Activity history</h3>
          <p>
            Key record access and updates are recorded in the audit trail below.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <h3>Protected connection</h3>
          <p>
            Hosted access uses HTTPS, with browser security policies on
            requests.
          </p>
        </article>
      </section>

      <div className="rx-assurance-cols">
        <section className="rx-card" aria-label="Audit trail">
          <h2>Audit trail</h2>
          <p className="rx-assurance-sub">
            The last accesses to this system, as recorded. The acting role is
            carried through the model&apos;s own asynchronous work, so one
            request cannot be attributed to another.
          </p>
          <AuditTrail />
        </section>

        <section className="rx-card" aria-label="Data handling">
          <h2>Data handling</h2>
          <dl className="rx-assurance-dl">
            <div>
              <dt>Demo records</dt>
              <dd>Patient information shown in this workspace is synthetic.</dd>
            </div>
            <div>
              <dt>Health imports</dt>
              <dd>
                Apple Health export files are read in the browser before
                selected readings are saved.
              </dd>
            </div>
            <div>
              <dt>Voice check-ins</dt>
              <dd>
                When enabled, voice conversations use the configured voice
                service. The check-in screen explains when voice is unavailable.
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rx-assurance-deploy" aria-label="Before clinical use">
        <h2>Before clinical use</h2>
        <p>
          Moving beyond this synthetic demo requires a production security and
          clinical validation program.
        </p>
        <ul>
          <li>Individual accounts and appropriate emergency access</li>
          <li>Encrypted, managed storage with verified backups</li>
          <li>Security, privacy, and regulatory review for the deployment</li>
          <li>Clinical evaluation with the intended care teams and patients</li>
        </ul>
      </section>
    </div>
  );
}

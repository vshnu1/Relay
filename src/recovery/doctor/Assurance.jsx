import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";

// What is true about this system's handling of health data, on screen rather
// than in a markdown file nobody opens. docs/COMPLIANCE.md and docs/FDA.md are
// the long versions; this is the part a clinician, a security reviewer or a
// procurement question needs in front of them.
//
// The rows that say "not met" are the point. A safeguard table showing only
// the safeguards that pass is marketing; the gaps, cited, are what makes the
// rest of it worth believing.

const BUILT = "built";
const PARTIAL = "partial";
const NOT_MET = "not-met";

const SAFEGUARDS = [
  {
    cite: "164.312(a)(1)",
    name: "Access control",
    state: BUILT,
    note: "Role gate with an allow-list of the five routes the patient view uses, constant-time code comparison, deny by default. A patient is scoped server-side to the one record their discharge code opens.",
  },
  {
    cite: "164.312(a)(2)(i)",
    name: "Unique user identification",
    state: NOT_MET,
    required: true,
    note: "Two shared codes, not accounts. The audit log can name a role and a record, never a person.",
  },
  {
    cite: "164.312(a)(2)(ii)",
    name: "Emergency access procedure",
    state: NOT_MET,
    required: true,
    note: "No break-glass path exists.",
  },
  {
    cite: "164.312(a)(2)(iii)",
    name: "Automatic logoff",
    state: BUILT,
    note: "Fifteen minutes, warned at fourteen. Activity is measured from real user events, so a polling timer or a streaming reading cannot hold a session open.",
  },
  {
    cite: "164.312(a)(2)(iv)",
    name: "Encryption at rest",
    state: NOT_MET,
    note: "State, audit log and event log are plaintext JSON at mode 0600 on a mounted disk.",
  },
  {
    cite: "164.312(b)",
    name: "Audit controls",
    state: BUILT,
    note: "Every access recorded with the acting role — record views, roster views, recovery-log reads, consent changes, acknowledgements, exports, imports. Shown below, live.",
  },
  {
    cite: "164.312(c)(1)",
    name: "Integrity",
    state: PARTIAL,
    note: "Atomic write via temp-and-rename, append-only audit log. Nothing prevents editing that log after the fact.",
  },
  {
    cite: "164.312(c)(2)",
    name: "Authenticate stored data",
    state: NOT_MET,
    note: "No checksums, no hash chain.",
  },
  {
    cite: "164.312(d)",
    name: "Person or entity authentication",
    state: NOT_MET,
    note: "The discharge code authenticates which record, server-side, but not which person: it is shared with whoever the patient shows it to and never expires.",
  },
  {
    cite: "164.312(e)(1)",
    name: "Transmission security",
    state: BUILT,
    note: "TLS at the edge, HSTS in production, content security policy, no-referrer, frame denial, a same-origin check on writes, and typefaces served from this origin so no font request tells a third party who opened a record.",
  },
];

const MARK = {
  [BUILT]: { icon: Check, label: "Built" },
  [PARTIAL]: { icon: Minus, label: "Partial" },
  [NOT_MET]: { icon: X, label: "Not met" },
};

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
  "recovery.read": "Read a patient's own record",
  "recovery.events": "Wrote to a record",
  "consent.changed": "Consent changed",
  "review.acknowledged": "Acknowledged a review",
  "handoff.exported": "Exported a handoff",
  "dataset.imported": "Imported readings",
  "checkin.voice.started": "Started a voice check-in",
  "ml.guard": "Model output checked by the language guard",
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
  const counts = SAFEGUARDS.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="rx-page rx-assurance">
      <header className="rx-pagehead">
        <div>
          <span className="rx-home-kicker">Security and compliance</span>
          <h1>What is true about how this handles health data</h1>
          <p className="rx-assurance-sub">
            Every patient here is synthetic, and this is not a compliant system
            — compliance is agreements, risk analyses and trained staff, which
            software cannot supply on its own. What follows is the part that is
            technical, with the gaps named rather than left out.
          </p>
        </div>
      </header>

      <section className="rx-card" aria-label="Technical safeguards">
        <h2>
          HIPAA Security Rule, technical safeguards{" "}
          <small>45 CFR 164.312</small>
        </h2>
        <p className="rx-assurance-count">
          {counts[BUILT]} built · {counts[PARTIAL] || 0} partial ·{" "}
          <strong>{counts[NOT_MET]} not met</strong>
        </p>
        <ul className="rx-safeguards">
          {SAFEGUARDS.map((s) => {
            const mark = MARK[s.state];
            const Icon = mark.icon;
            return (
              <li key={s.cite} className={s.state}>
                <span className="rx-safeguard-mark" title={mark.label}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="rx-visually-hidden">{mark.label}</span>
                </span>
                <div>
                  <p className="rx-safeguard-name">
                    {s.name}
                    {s.required && s.state === NOT_MET && (
                      <em> — required, not addressable</em>
                    )}
                  </p>
                  <p className="rx-safeguard-note">{s.note}</p>
                </div>
                <code>{s.cite}</code>
              </li>
            );
          })}
        </ul>
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

        <section className="rx-card" aria-label="Regulatory position">
          <h2>Regulatory position</h2>
          <dl className="rx-assurance-dl">
            <div>
              <dt>Is this a medical device?</dt>
              <dd>
                On our own reading, <strong>probably yes</strong>. Clinical
                decision support is exempt under FD&amp;C Act 520(o)(1)(E) only
                if all four criteria hold, and we fail the first: it excludes
                software that analyses a pattern from a signal acquisition
                system, and that is exactly what reading a wearable stream and
                requiring 24 hours of persistence is.
              </dd>
            </div>
            <div>
              <dt>Which law would apply</dt>
              <dd>
                Contracted to a hospital, this is a HIPAA business associate.
                Sold to patients directly it is not HIPAA at all, but the FTC
                Health Breach Notification Rule. Washington&apos;s My Health My
                Data Act reaches either, and carries a private right of action.
              </dd>
            </div>
            <div>
              <dt>Where the data goes</dt>
              <dd>
                An Apple Health export is inflated and parsed{" "}
                <strong>in the browser</strong>. It is never uploaded, and no
                third-party model sees it. The voice check-in is the only path
                that leaves this origin, it is restricted to synthetic patients,
                and it carries no name or free text.
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rx-card" aria-label="How the thresholds were set">
        <h2>What the numbers are, and what they are not</h2>
        <dl className="rx-assurance-dl wide">
          <div>
            <dt>False alarms, in sample</dt>
            <dd>
              <strong>3.35%</strong> of subject-days across 66 of 71 real
              wearable subjects, at the shipped 1.75 sd. Measured against a
              baseline built from a subject&apos;s whole series, which includes
              the day being judged.
            </dd>
          </div>
          <div>
            <dt>False alarms, as deployed</dt>
            <dd>
              <strong>6.04%</strong>. The same rule judging each day only
              against the days before it, which is all a deployment has. The two
              are reported separately because quoting the first as the second
              overstates this by nearly half.
            </dd>
          </div>
          <div>
            <dt>How fast it sees a real change</dt>
            <dd>
              A coordinated change of two personal standard deviations is seen{" "}
              <strong>the next day</strong>, against five days for the same
              person&apos;s own noise. The gain is in the speed, not the rate.
            </dd>
          </div>
          <div>
            <dt>What is unmeasured</dt>
            <dd>
              <strong>Sensitivity.</strong> Nobody in the reference cohort
              deteriorated after a discharge, so there is no positive class to
              count. How often this stays quiet when it should speak is unknown,
              and no clinical validation study exists.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

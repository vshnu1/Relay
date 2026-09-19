import "./assurance.css";
import { authHeaders } from "../model/authHeaders.js";
import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  ClipboardCheck,
  FileDown,
  KeyRound,
  LockKeyhole,
  Minus,
  ShieldCheck,
  X,
} from "lucide-react";

// What is true about this system's handling of health data, on screen rather
// than in a markdown file nobody opens. docs/COMPLIANCE.md and docs/FDA.md are
// the long versions; this is the part a clinician, a security reviewer or a
// procurement question needs in front of them.
//
// Each row carries what it was and what it still does not do, so a row that reads
// "built" says enough for a reader to decide whether to believe it. What an
// organisation has to add before clinical use is listed at the foot of the page.

const BUILT = "built";
const PARTIAL = "partial";
const NOT_MET = "not-met";

// Each row says what is true of this running process. Four of these were unmet
// this morning; the ones that changed carry what was wrong, because a row that
// simply reads "built" teaches a reader nothing about whether to believe the
// others.
const SAFEGUARDS = [
  {
    cite: "164.312(a)(1)",
    name: "Access control",
    state: BUILT,
    note: "Role gate with an allow-list of the routes the patient view uses, constant-time code comparison, deny by default. A patient is scoped server-side to the one record their account is for. A clinician account is for one care team and is refused every other team's records, on reads and on writes.",
    live: "scoping",
  },
  {
    cite: "164.312(a)(2)(i)",
    name: "Unique user identification",
    state: BUILT,
    was: "Two shared codes, not accounts. The log could name a role and a record, never a person.",
    note: "Named accounts with scrypt-hashed passwords. Every audit line carries the acting person, not only their role. The access code is now an invitation that decides which role an account is created with; it opens no record by itself.",
    caveat:
      "No multi-factor authentication, and nobody checks that a new account belongs to the clinician it names.",
  },
  {
    cite: "164.312(a)(2)(ii)",
    name: "Emergency access procedure",
    state: BUILT,
    was: "A break-glass control that recorded a declaration and lifted nothing, because clinician access was not partitioned. This row read Partial for that reason.",
    note: "A clinician whose account is for one care team is refused any other record. Declaring emergency access opens that one record for fifteen minutes. It requires a reason in a sentence, and the refusal, the declaration and every read made under it are written to the audit chain under the clinician's name. It is shown on this page while it is open.",
    caveat:
      "Which team an account is for is chosen at sign-up, where a hospital would have an administrator assign it. The demo identities are for the whole ward on purpose, so a visitor sees every patient; sign in with an account for one unit to see a record refused.",
    live: "scoping",
  },
  {
    cite: "164.312(a)(2)(iii)",
    name: "Automatic logoff",
    state: BUILT,
    was: "The browser signed you out. The credential stayed valid, because there was no session store to revoke.",
    note: "Fifteen minutes without activity, measured from real user events so a polling timer cannot hold a session open. Sessions live on the server with a twelve-hour ceiling, so signing out ends the session rather than clearing the tab.",
  },
  {
    cite: "164.312(a)(2)(iv)",
    name: "Encryption at rest",
    state: BUILT,
    was: "State, audit log and event log were plaintext JSON at mode 0600.",
    note: "AES-256-GCM over the state file, the account store and every audit line, under a key this process reads from its environment. The live mode is reported below rather than asserted here.",
    live: "encryption",
  },
  {
    cite: "164.312(b)",
    name: "Audit controls",
    state: BUILT,
    note: "Every access recorded with the acting person and role: record views, roster views, recovery-log reads, consent changes, acknowledgements, exports, imports, sign-ins and emergency access. Shown below, live.",
  },
  {
    cite: "164.312(c)(1)",
    name: "Integrity",
    state: BUILT,
    was: "Append-only by convention. Nothing prevented editing the log afterwards.",
    note: "Atomic write via temp-and-rename, and the audit log is a hash chain: each line commits to the one before it, so an edited or deleted line breaks every digest after it.",
    live: "chain",
  },
  {
    cite: "164.312(c)(2)",
    name: "Authenticate stored data",
    state: BUILT,
    was: "No checksums, no hash chain.",
    note: "The chain is verified on demand and the check reports the line number where the history stops adding up. The digest covers the bytes as written, so it is checkable by someone holding the file and no key.",
    live: "chain",
  },
  {
    cite: "164.312(d)",
    name: "Person or entity authentication",
    state: BUILT,
    was: "The discharge code authenticated which record, never which person.",
    note: "A password nobody else holds, checked in constant time against a stretched hash, exchanged for a revocable server-side session.",
    caveat:
      "This authenticates an account, not a human being. Identity proofing and a second factor are what a hospital deployment would add.",
  },
  {
    cite: "164.312(e)(1)",
    name: "Transmission security",
    state: BUILT,
    note: "TLS at the edge, HSTS in production, a content security policy with no third-party script origin, no-referrer, frame denial, a same-origin check on writes, and typefaces served from this origin so no font request tells a third party who opened a record.",
  },
];

// Privacy Rule obligations that a program can carry part of. Kept apart from the
// Security Rule table above because they are a different rule, and because one of
// them is still only partly done.
const PRIVACY = [
  {
    cite: "164.524",
    name: "Right of access",
    state: BUILT,
    was: "No patient-facing export of any kind.",
    note: "A patient can save a copy of everything held about them from Your data, as text to read or print and as data for another clinic or app: discharge notes, medicines, appointments, check-ins, messages and every reading. Taking a copy is recorded on their own record. The sign-in code is left out of the file.",
  },
  {
    cite: "164.502(b)",
    name: "Minimum necessary",
    state: PARTIAL,
    note: "Access is limited by role and now by care team: a patient reaches one record, a clinician reaches their team's, and the ward list carries no raw events.",
    caveat:
      "Within a record a clinician still receives all of it. Limiting fields by job (a scheduler does not need check-in answers) is not built.",
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
  "audit.unreadable": "An entry written under a previous key",
  "account.created": "Created an account",
  "account.signed_in": "Signed in",
  "account.signed_out": "Signed out",
  "account.demo_issued": "Entered as a demo identity",
  "access.refused": "Refused a record outside the care team",
  "emergency.access_opened": "Declared emergency access",
};

// What this process is doing, as opposed to what this file says it does. A
// deployment missing its key, or still accepting a shared code, would otherwise
// have gone on claiming otherwise on the strength of a constant in the source.
function useSafeguards() {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/safeguards", { headers: authHeaders({ json: false }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((body) => alive && setLive(body))
      .catch(() => alive && setLive(false));
    return () => {
      alive = false;
    };
  }, []);
  return live;
}

function AuditTrail() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/audit", { headers: authHeaders({ json: false }) })
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
            {r.onBehalfOf === "break-glass" ? " · under emergency access" : ""}
            {r.actorEmail ? ` · ${r.actorEmail}` : ""}
          </span>
          <time dateTime={r.at}>{ago(r.at)}</time>
        </li>
      ))}
    </ul>
  );
}

export default function Assurance() {
  const live = useSafeguards();
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
            Every patient here is synthetic, and this is a prototype, not a
            compliant system. The technical safeguards below are all in place,
            and a patient can take a copy of their own record. What an
            organisation adds before clinical use is listed at the foot of the
            page.
          </p>
        </div>
      </header>

      {/* Four plain sentences before the citations, so a clinician who is not
          a compliance officer gets the shape of it and can stop there. The
          table below is for the reader who does not want to take it on
          trust. */}
      <section className="rx-assurance-points" aria-label="In short">
        <article className="rx-assurance-point">
          <span>
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <h3>You sign in as you</h3>
          <p>
            Named accounts, not a shared code, so the record of who opened what
            names a person.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <KeyRound size={18} aria-hidden="true" />
          </span>
          <h3>You see your own team&apos;s patients</h3>
          <p>
            Any other record is refused until you declare an emergency for it,
            with a reason, for fifteen minutes. All of that is recorded.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <Activity size={18} aria-hidden="true" />
          </span>
          <h3>Sessions end by themselves</h3>
          <p>
            Fifteen minutes without activity, then ended on the server, not only
            in your browser.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <ClipboardCheck size={18} aria-hidden="true" />
          </span>
          <h3>The log cannot be edited quietly</h3>
          <p>
            Each entry commits to the one before it, so a changed or missing
            line is detectable and locatable.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <h3>Nothing third-party is in the way</h3>
          <p>
            Encrypted at rest, TLS in transit, and no outside script on the page
            that opens a record.
          </p>
        </article>
        <article className="rx-assurance-point">
          <span>
            <FileDown size={18} aria-hidden="true" />
          </span>
          <h3>Patients can take their record with them</h3>
          <p>
            A full copy from their own app, to read or to hand to another
            clinic, and taking one is recorded too.
          </p>
        </article>
      </section>

      <section className="rx-card" aria-label="Technical safeguards">
        <h2>
          HIPAA Security Rule, technical safeguards{" "}
          <small>45 CFR 164.312</small>
        </h2>
        <p className="rx-assurance-count">
          {counts[BUILT]} built · {counts[PARTIAL] || 0} partial ·{" "}
          {counts[NOT_MET] || 0} not met
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
                  {s.live === "encryption" && live && (
                    <p className="rx-safeguard-live">
                      Live:{" "}
                      {live.encryptionAtRest.mode === "none"
                        ? "no key is set on this deployment, so these files are written unencrypted."
                        : `${live.encryptionAtRest.mode}, key present.`}
                    </p>
                  )}
                  {s.live === "scoping" && live && live.accessScoping && (
                    <p className="rx-safeguard-live">
                      Live: {live.accessScoping.careTeams} care teams.{" "}
                      {live.accessScoping.scopedAccounts} clinician{" "}
                      {live.accessScoping.scopedAccounts === 1
                        ? "account is"
                        : "accounts are"}{" "}
                      for one team, {live.accessScoping.wardWideAccounts} for
                      the whole ward
                      {live.accessScoping.unassignedAccounts > 0 &&
                        `, and ${live.accessScoping.unassignedAccounts} from before teams existed, which still reach the whole ward`}
                      {live.accessScoping.sharedCodesAccepted &&
                        ". This deployment also accepts a shared code, which names no person and cannot be scoped"}
                      .
                    </p>
                  )}
                  {s.live === "chain" && live && (
                    <p className="rx-safeguard-live">
                      Live:{" "}
                      {live.auditChain.intact
                        ? `${live.auditChain.chained} chained ${live.auditChain.chained === 1 ? "line" : "lines"}, intact`
                        : `chain breaks at line ${live.auditChain.brokenAt} (${live.auditChain.reason})`}
                      {live.auditChain.unchained > 0 &&
                        `, and ${live.auditChain.unchained} older ${live.auditChain.unchained === 1 ? "line" : "lines"} written before this log was chained`}
                      .
                    </p>
                  )}
                  {s.was && (
                    <p className="rx-safeguard-was">
                      <strong>Was:</strong> {s.was}
                    </p>
                  )}
                  {s.caveat && (
                    <p className="rx-safeguard-caveat">
                      <strong>Still not:</strong> {s.caveat}
                    </p>
                  )}
                </div>
                <code>{s.cite}</code>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rx-card" aria-label="Privacy Rule">
        <h2>
          HIPAA Privacy Rule, the parts a program can carry{" "}
          <small>45 CFR 164.502, 164.524</small>
        </h2>
        <ul className="rx-safeguards">
          {PRIVACY.map((s) => {
            const mark = MARK[s.state];
            const Icon = mark.icon;
            return (
              <li key={s.cite} className={s.state}>
                <span className="rx-safeguard-mark" title={mark.label}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="rx-visually-hidden">{mark.label}</span>
                </span>
                <div>
                  <p className="rx-safeguard-name">{s.name}</p>
                  <p className="rx-safeguard-note">{s.note}</p>
                  {s.was && (
                    <p className="rx-safeguard-was">
                      <strong>Was:</strong> {s.was}
                    </p>
                  )}
                  {s.caveat && (
                    <p className="rx-safeguard-caveat">
                      <strong>Still not:</strong> {s.caveat}
                    </p>
                  )}
                </div>
                <code>{s.cite}</code>
              </li>
            );
          })}
        </ul>
      </section>

      {live && live.unreadableFiles?.length > 0 && (
        <section className="rx-card rx-breakglass" aria-label="Unreadable data">
          <h2>Something on disk cannot be read with the current key</h2>
          <p className="rx-safeguard-note">
            {live.unreadableFiles.map((f) => f.file).join(", ")} was written
            under a different encryption key, so this process started without
            it. The file has been kept, not deleted. Anything it held —
            accounts, sessions — will need to be created again, or the original
            key restored.
          </p>
        </section>
      )}

      {live && live.emergencyAccess.open.length > 0 && (
        <section
          className="rx-card rx-breakglass"
          aria-label="Emergency access"
        >
          <h2>Emergency access is open</h2>
          {live.emergencyAccess.open.map((grant) => (
            <p key={grant.openedAt} className="rx-safeguard-note">
              <strong>{grant.by}</strong> took emergency access
              {grant.patientId ? ` to ${grant.patientId}` : ""} and gave the
              reason: “{grant.reason.replace(/[.\s]+$/, "")}”. It lapses on its
              own.
            </p>
          ))}
        </section>
      )}

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
                that leaves this origin, and the server refuses it for any
                record outside the synthetic roster. It carries a first name,
                the recovery pathway and a readings summary — and, it being a
                call, whatever the patient says. No surname, no identifier, no
                stored note.
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
              overstates the product by nearly half.
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
      <section className="rx-assurance-deploy" aria-label="Before clinical use">
        <h2>Before clinical use</h2>
        <p>
          Individual accounts, care-team scoping with emergency access,
          encryption at rest and a patient&apos;s copy of their record were on
          this list until today and are now above it. Most of what is left is
          not engineering.
        </p>
        <ul>
          <li>
            A second factor, and an administrator who checks that an account
            belongs to the clinician it names and assigns its care team, which
            the clinician currently picks at sign-up
          </li>
          <li>
            Managed storage with verified backups, under a business associate
            agreement the hosting plan does not currently include
          </li>
          <li>
            A security and privacy review, a risk analysis, and workforce
            training, performed by an organisation and repeated
          </li>
          <li>
            Clinical evaluation with the intended care teams and patients, and
            the regulatory determination above
          </li>
        </ul>
      </section>
    </div>
  );
}

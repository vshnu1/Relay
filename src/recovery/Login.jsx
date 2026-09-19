import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { go } from "./useRecovery.js";
import { LANDING_URL } from "./landingUrl.js";

const DEMO_EMAIL = "clinician@relay.demo";

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("demo-only");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (onSignedIn) {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });
        const body = await res.json();
        if (!res.ok || body.role !== "clinician") {
          setError("Enter a valid clinician access code.");
          return;
        }
        onSignedIn(body.role, code.trim());
      } catch {
        setError("Could not reach the server. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("Enter the demo email and password to continue.");
      return;
    }
    setError("");
    // Demo navigation only. Production access must be verified by the server.
    setPassword("");
    go("/doctor");
  }

  return (
    <main className="rx-auth-page">
      <div className="rx-auth-shell">
        <div className="rx-auth-grid">
          <section className="rx-auth-intro">
            <a
              className="rx-brand rx-auth-brand"
              href={LANDING_URL}
              aria-label="Relay home page"
            >
              <span className="rx-brand-mark">
                <Activity size={19} strokeWidth={2.4} />
              </span>
              Relay
            </a>
            <span className="rx-eyebrow">
              <ShieldCheck size={14} /> Clinician workspace
            </span>
            <h1>Welcome back, care team.</h1>
            <p>
              Sign in to review wearable changes, patient check-ins, and the
              context your care team needs after discharge.
            </p>
            <div className="rx-auth-promise">
              <CheckCircle2 size={18} />
              <span>
                <strong>Synthetic demo workspace</strong>
                <small>
                  Explore with the demo account. Do not enter real credentials
                  or patient information.
                </small>
              </span>
            </div>
          </section>

          <section className="rx-auth-card" aria-label="Sign in">
            <div className="rx-auth-card-head">
              <div>
                <span className="rx-auth-kicker">Clinician access</span>
                <h2>Sign in to Relay</h2>
              </div>
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <p className="rx-auth-demo-note" id="rx-demo-access-note">
              {onSignedIn
                ? "For doctors and nurses. Enter your clinician access code."
                : "For doctors and nurses. Continue with the prefilled demo account."}
            </p>
            <form onSubmit={submit}>
              {onSignedIn ? (
                <label className="rx-auth-label" htmlFor="rx-clinician-code">
                  Clinician access code
                  <input
                    id="rx-clinician-code"
                    type="password"
                    autoComplete="off"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              ) : (
                <>
                  <label className="rx-auth-label" htmlFor="rx-email">
                    Work email
                    <input
                      id="rx-email"
                      type="email"
                      autoComplete="off"
                      readOnly
                      aria-describedby="rx-demo-access-note"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label className="rx-auth-label" htmlFor="rx-password">
                    Password
                    <input
                      id="rx-password"
                      type="password"
                      autoComplete="off"
                      readOnly
                      aria-describedby="rx-demo-access-note"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <p className="rx-auth-error" role="alert">
                  {error}
                </p>
              )}
              <button className="rx-auth-submit" type="submit" disabled={busy}>
                {busy ? "Checking…" : "Continue to clinician workspace"}{" "}
                <ArrowRight size={17} />
              </button>
            </form>
            <p className="rx-auth-legal">
              Shared-code demo access only. Individual hospital accounts are not
              connected yet. Every patient shown is synthetic.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

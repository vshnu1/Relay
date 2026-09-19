import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { go } from "./useRecovery.js";

const DEMO_EMAIL = "clinician@relay.demo";

export default function Login() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("demo-only");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
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
            <span className="rx-brand rx-auth-brand">
              <span className="rx-brand-mark">
                <Activity size={19} strokeWidth={2.4} />
              </span>
              relay
            </span>
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
                  Explore with the demo account. Do not enter real credentials or
                  patient information.
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
              For doctors and nurses. Continue with the prefilled demo account.
            </p>
            <form onSubmit={submit}>
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
              {error && <p className="rx-auth-error" role="alert">{error}</p>}
              <button className="rx-auth-submit" type="submit">
                Continue to clinician workspace <ArrowRight size={17} />
              </button>
            </form>
            <p className="rx-auth-legal">
              Demo access only. Hospital sign-in is not connected yet. Real
              patient data requires verified accounts and server-enforced access controls.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

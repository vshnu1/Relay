import { useState } from "react";
import {
  Activity,
  ArrowLeft,
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
  const [role, setRole] = useState("doctor");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter the demo email and password to continue.");
      return;
    }
    setError("");
    if (remember) sessionStorage.setItem("rx-demo-session", "remembered");
    sessionStorage.setItem("rx-role", role);
    go(`/${role}`);
  }

  return (
    <main className="rx-auth-page">
      <div className="rx-auth-shell">
        <a className="rx-auth-back" href="#/">
          <ArrowLeft size={16} /> Back to Relay
        </a>
        <div className="rx-auth-grid">
          <section className="rx-auth-intro">
            <span className="rx-brand rx-auth-brand">
              <span className="rx-brand-mark">
                <Activity size={19} strokeWidth={2.4} />
              </span>
              relay
            </span>
            <span className="rx-eyebrow">
              <ShieldCheck size={14} /> Secure workspace access
            </span>
            <h1>Welcome back to a clearer recovery picture.</h1>
            <p>
              Sign in to review wearable changes, patient check-ins, and the
              context your care team needs after discharge.
            </p>
            <div className="rx-auth-promise">
              <CheckCircle2 size={18} />
              <span>
                <strong>Demo-safe by design</strong>
                <small>
                  This prototype uses synthetic records and does not accept real
                  patient information.
                </small>
              </span>
            </div>
          </section>

          <section className="rx-auth-card" aria-label="Sign in">
            <div className="rx-auth-card-head">
              <div>
                <span className="rx-auth-kicker">Relay workspace</span>
                <h2>Sign in</h2>
              </div>
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <p className="rx-auth-demo-note">
              Use the prefilled demo account to explore the prototype.
            </p>
            <form onSubmit={submit}>
              <label className="rx-auth-label" htmlFor="rx-email">
                Work email
                <input
                  id="rx-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="rx-auth-label" htmlFor="rx-password">
                Password
                <input
                  id="rx-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <fieldset className="rx-auth-role">
                <legend>Continue as</legend>
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="doctor"
                    checked={role === "doctor"}
                    onChange={() => setRole("doctor")}
                  />
                  Clinician
                </label>
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="patient"
                    checked={role === "patient"}
                    onChange={() => setRole("patient")}
                  />
                  Patient
                </label>
              </fieldset>
              <label className="rx-auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Keep me signed in on this demo device
              </label>
              {error && <p className="rx-auth-error">{error}</p>}
              <button className="rx-auth-submit" type="submit">
                Continue <ArrowRight size={17} />
              </button>
            </form>
            <p className="rx-auth-legal">
              Production access would use organization-managed identity, MFA,
              least-privilege roles, short-lived sessions, audit logs, and
              encrypted transport and storage. This screen is a frontend demo;
              it is not a HIPAA certification.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

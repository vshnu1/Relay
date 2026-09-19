import { useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  User,
} from "lucide-react";
import { go } from "./useRecovery.js";
import { signIn as openPatientProfile } from "./patient/session.js";

// Signing in as a person, where the product used to sign you in as a role.
//
// Two shared codes meant the audit log could say a clinician opened a record
// and never which clinician, which is why 164.312(a)(2)(i) and (d) were both
// marked not met, and both are required rather than addressable. The code is
// still here; it has become the invitation rather than the key.
//
// The demo button is not a way round that. It mints a distinct principal per
// browser, so two people looking at the deployed demo at the same time are two
// actors in the log rather than one anonymous clinician, and every action they
// take is attributable afterwards.

// This runs on a free instance that sleeps when nobody is using it. The first
// request after a quiet spell wakes it, and until it is up the edge answers 502
// with an HTML page rather than JSON. Read naively that is an empty error
// message and a button that appears to do nothing, which is exactly how it
// looked. So: keep trying for a while, and say what is happening meanwhile.
const WAKING = /^(429|5\d\d)$/;

const post = async (path, body, onProgress) => {
  const deadline = Date.now() + 45000;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    let response;
    try {
      response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // The server is not answering at all yet.
      if (Date.now() > deadline)
        throw new Error(
          "The server is not responding. It may still be starting up; wait a moment and try again.",
        );
      onProgress?.("Waking the server…");
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (response.ok) return response.json();

    const payload = await response.json().catch(() => null);
    const retryable = WAKING.test(String(response.status));
    if (retryable && Date.now() < deadline) {
      onProgress?.(
        attempt === 1 ? "Waking the server…" : "Still waking the server…",
      );
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    throw new Error(
      payload?.error ||
        (retryable
          ? "The server is still starting up. Give it a minute and try again."
          : `That did not work (${response.status}).`),
    );
  }
};

export default function Account({ onSignedIn, audience = "clinician" }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const done = (payload) => {
    // A demo patient arrives with one synthetic record already chosen, so the
    // click opens the patient application rather than a second sign-in asking
    // for a discharge code the visitor cannot know.
    if (payload.patient?.patientId && payload.patient?.dischargeCode)
      openPatientProfile(
        payload.patient.patientId,
        payload.patient.dischargeCode,
      );
    onSignedIn(payload.user.role, payload.token, payload.user);
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      done(
        mode === "signin"
          ? await post("/api/auth/login", { email, password }, setStatus)
          : await post(
              "/api/auth/register",
              { email, password, invite },
              setStatus,
            ),
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function demo() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      done(await post("/api/auth/demo", { role: audience }, setStatus));
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <main className="rx-auth-page">
      <div className="rx-auth-shell">
        <div className="rx-auth-grid">
          <section className="rx-auth-intro">
            <span className="rx-brand rx-auth-brand">
              <span className="rx-brand-mark" aria-hidden="true" />
              <span className="rx-brand-word">Relay</span>
            </span>
            <span className="rx-home-kicker">
              {audience === "patient" ? "Patient access" : "Clinician access"}
            </span>
            {/* Relay is two applications that never open together, and until
                now the patient one was reachable only by typing its URL. Both
                doors are on the screen, and choosing changes the route, so the
                address bar says which side you are looking at. */}
            <div
              className="rx-role-switch"
              role="group"
              aria-label="Who are you signing in as?"
            >
              <button
                type="button"
                className={audience === "clinician" ? "active" : ""}
                aria-pressed={audience === "clinician"}
                onClick={() => go("/doctor")}
              >
                <Stethoscope size={18} aria-hidden="true" />
                <strong>I am on the care team</strong>
                <span>
                  The ward list, the readings, and the evidence packet
                </span>
              </button>
              <button
                type="button"
                className={audience === "patient" ? "active" : ""}
                aria-pressed={audience === "patient"}
                onClick={() => go("/patient")}
              >
                <User size={18} aria-hidden="true" />
                <strong>I am the patient</strong>
                <span>
                  Your own readings, your check-in, and what you share
                </span>
              </button>
            </div>
            <h1>Sign in as yourself.</h1>
            <p className="rx-auth-lede">
              <strong>Just looking?</strong> Use the demo button under the form.
              It takes one click, needs nothing from you, and opens the full
              workspace.
            </p>
            <p className="rx-auth-lede">
              <strong>Have an account?</strong> Sign in with your email and
              password. <strong>Creating one</strong> needs the access code your
              care team issued; the code decides whether you get the clinician
              or the patient view, and opens no record by itself.
            </p>
            <p className="rx-auth-why">
              Relay used to take one shared code per role. It could record that
              a clinician opened a record and never which clinician, so a breach
              investigation starting from the log could not answer the only
              question it exists to answer.
            </p>
            <ul className="rx-auth-points">
              <li>
                <ShieldCheck size={16} aria-hidden="true" />
                Your password is stretched with scrypt and never stored.
              </li>
              <li>
                <LockKeyhole size={16} aria-hidden="true" />
                Sessions are held on the server, so signing out ends them
                everywhere rather than clearing this tab.
              </li>
            </ul>
            <p className="rx-auth-note">
              Every patient in this workspace is synthetic. Do not enter real
              credentials or real patient information.
            </p>
          </section>

          <section className="rx-auth-card">
            <div className="rx-auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "active" : ""}
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create an account
              </button>
            </div>

            <form onSubmit={submit}>
              <label className="rx-auth-label" htmlFor="rx-acct-email">
                Work email
                <input
                  id="rx-acct-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="rx-auth-label" htmlFor="rx-acct-password">
                Password
                <input
                  id="rx-acct-password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "register" ? 10 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "register" && <small>At least ten characters.</small>}
              </label>

              {mode === "register" && (
                <>
                  <label className="rx-auth-label" htmlFor="rx-acct-invite">
                    Access code from your care team
                    <input
                      id="rx-acct-invite"
                      type="password"
                      autoComplete="off"
                      required
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                    />
                    <small>
                      The same code your team uses to open Relay. Ask whoever
                      set up this workspace. It decides which view your account
                      gets and opens no record on its own.
                    </small>
                  </label>
                </>
              )}

              {error && (
                <p className="rx-auth-error" role="alert">
                  {error}
                </p>
              )}

              <button className="rx-auth-submit" type="submit" disabled={busy}>
                {busy
                  ? status || "Checking…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>

            <div className="rx-auth-or">
              <span>or</span>
            </div>
            <button
              type="button"
              className="rx-auth-demo"
              disabled={busy}
              onClick={demo}
            >
              {busy
                ? status || "One moment…"
                : `Look around as a demo ${audience}`}
            </button>
            <p className="rx-auth-legal">
              A demo identity is issued to this browser alone and named in the
              audit trail, so what it does stays attributable. It reaches
              synthetic records only.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

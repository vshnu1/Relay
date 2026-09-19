import { rememberUser } from "./model/currentUser.js";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { signIn as openPatientProfile } from "./patient/session.js";
import { LANDING_URL } from "./landingUrl.js";

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

// One screen, two doors, and no way to switch between them here. The public landing
// page sends patients to #/patient from every main button and the care team to
// #/login from one line in its footer, so each door says only what its own reader
// needs. The logo goes back to the landing page, which is where the other door is.
const DOORS = {
  patient: {
    kicker: "RELAY · PATIENT SIGN-IN",
    title: "Welcome to Relay.",
    lede: "Sign in to see your readings, your check-in and messages from your care team.",
    cardKicker: "Patient account",
    cardTitle: "Open your recovery profile",
    email: "Email",
  },
  clinician: {
    kicker: "RELAY · CARE TEAM SIGN-IN",
    title: "Welcome back, care team.",
    lede: "Sign in to review your patients' readings, check-ins and messages.",
    cardKicker: "Care team account",
    cardTitle: "Access your workspace",
    email: "Work email",
  },
};

export default function Account({ onSignedIn, audience = "clinician" }) {
  const door = DOORS[audience] || DOORS.clinician;
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [dischargeCode, setDischargeCode] = useState("");
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
    rememberUser(payload.user);
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
              {
                email,
                password,
                invite,
                name,
                ...(audience === "patient" ? { dischargeCode } : {}),
              },
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
            <a
              className="rx-brand rx-auth-brand"
              href={LANDING_URL}
              aria-label="Relay home page"
            >
              <span className="rx-brand-mark" aria-hidden="true" />
              <span className="rx-brand-word">Relay</span>
            </a>
            <span className="rx-home-kicker">{door.kicker}</span>
            <h1>{door.title}</h1>
            <p className="rx-auth-lede">{door.lede}</p>
            <p className="rx-auth-note">
              Demo access uses synthetic patient information. Do not enter real
              patient details.
            </p>
          </section>

          <section className="rx-auth-card">
            <span className="rx-auth-kicker">{door.cardKicker}</span>
            <h2 className="rx-auth-card-title">{door.cardTitle}</h2>
            <div
              className="rx-auth-tabs"
              role="group"
              aria-label="Account access"
            >
              <button
                type="button"
                aria-pressed={mode === "signin"}
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
                aria-pressed={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create an account
              </button>
            </div>

            <p className="rx-auth-card-intro">
              {mode === "signin"
                ? "Sign in with your email and password."
                : "Create an account with the invitation code from your care team."}
            </p>

            <form onSubmit={submit}>
              <label className="rx-auth-label" htmlFor="rx-acct-email">
                {door.email}
                <input
                  id="rx-acct-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {mode === "register" && (
                <label className="rx-auth-label" htmlFor="rx-acct-name">
                  Your name
                  <input
                    id="rx-acct-name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
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

              {mode === "register" && audience === "patient" && (
                <label className="rx-auth-label" htmlFor="rx-acct-discharge">
                  Discharge code
                  <input
                    id="rx-acct-discharge"
                    type="text"
                    autoComplete="off"
                    required
                    value={dischargeCode}
                    onChange={(e) => setDischargeCode(e.target.value)}
                  />
                  <small>
                    This links your account to your own recovery record.
                  </small>
                </label>
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
              Demo access is limited to synthetic patient records.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

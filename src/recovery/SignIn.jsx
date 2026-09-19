import { useState } from "react";

// Sign-in for the two roles. The code is verified by the server, not here —
// a check in the browser would be decoration. What this cannot do is tell
// which patient is signing in, because the code is shared per role, so the
// server can refuse the cohort to a patient but cannot scope to one record.
// docs/PRIVACY.md states that limit rather than hiding it.
export default function SignIn({ onSignedIn }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!code.trim()) {
      setError("Enter the access code your care team gave you.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "That code was not recognised.");
        return;
      }
      onSignedIn(body.role, code.trim());
    } catch {
      setError("Could not reach the server. Check it is running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rx rx-landing">
      <main className="rx-landing-inner">
        <div className="rx-brand">
          <span className="rx-brand-mark" aria-hidden="true" />
          <span className="rx-brand-word">relay</span>
        </div>
        <h1 className="rx-landing-lede">Sign in to continue.</h1>
        <p className="rx-signin-sub">
          Your care team gives patients one code and clinicians another. The
          code decides which view you get.
        </p>
        <form className="rx-signin-form" onSubmit={submit}>
          <label className="rx-signin-label" htmlFor="rx-code">
            Access code
          </label>
          <input
            id="rx-code"
            className="rx-signin-input"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError("");
            }}
            placeholder="Enter your code"
          />
          {error && (
            <p className="rx-signin-error" role="alert">
              {error}
            </p>
          )}
          <button className="rx-signin-button" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
        <div className="rx-landing-note">
          <p className="rx-landing-note-title">About these codes</p>
          <ul>
            <li>
              One shared code per role, checked by the server. A production
              deployment needs an account for each person.
            </li>
            <li>
              The code cannot identify which patient you are, so the patient
              view is limited rather than personalised by identity.
            </li>
            <li>Every patient in this demo is synthetic.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

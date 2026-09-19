import { useState } from "react";
import { Activity } from "lucide-react";

// Sign-in for the two roles. The code is verified by the server, not here -
// a check in the browser would be decoration. What this cannot do is tell
// which patient is signing in, because the code is shared per role, so the
// server can refuse the cohort to a patient but cannot scope to one record.
// docs/PRIVACY.md states that limit rather than hiding it.
export default function SignIn({ onSignedIn, audience = "patient" }) {
  const isPatient = audience === "patient";
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
          <span className="rx-brand-mark" aria-hidden="true">
            <Activity size={19} strokeWidth={2.4} />
          </span>
          <span className="rx-brand-word">Relay</span>
        </div>
        <h1 className="rx-landing-lede">
          {isPatient ? "Patient access" : "Clinician access"}
        </h1>
        <p className="rx-signin-sub">
          {isPatient
            ? "Enter the shared patient access code from your care team. Next, you’ll sign in to your discharge profile with your personal code."
            : "Enter the clinician access code from your care team to open the clinician workspace."}
        </p>
        <form className="rx-signin-form" onSubmit={submit}>
          <label className="rx-signin-label" htmlFor="rx-code">
            {isPatient ? "Patient access code" : "Clinician access code"}
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
          <p className="rx-landing-note-title">About access</p>
          <ul>
            {isPatient ? (
              <>
                <li>
                  This shared code opens the patient portal. Your personal
                  discharge code selects your profile on the next screen.
                </li>
                <li>Every patient record in this demo is synthetic.</li>
              </>
            ) : (
              <>
                <li>The shared clinician code is checked by the server.</li>
                <li>
                  A production deployment gives each team member a personal
                  account.
                </li>
              </>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}

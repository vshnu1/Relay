import { useState } from "react";
import { Activity, KeyRound } from "lucide-react";
import { normalizeCode } from "./session.js";

const formatCode = (value) => {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
};

// Hospital first, then the discharge code the hospital handed over at discharge.
export default function SignIn({ roster, onSignIn }) {
  const hospitals = [...new Set(roster.map((p) => p.hospital))].sort();
  const [hospital, setHospital] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const match = roster.find(
      (p) => p.hospital === hospital && p.code === normalizeCode(code),
    );
    if (!hospital) return setError("Choose your hospital first.");
    if (!match)
      return setError(
        "That code does not match a discharge from this hospital. Check the letter you were given.",
      );
    if (!agreed)
      return setError("Please agree to share your readings to continue.");
    setError("");
    onSignIn(match.id);
  };
  return (
    <>
      <header className="rx-p-top">
        <span className="rx-brand">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          relay
        </span>
      </header>
      <h1 className="rx-p-title">Open your recovery</h1>
      <p className="rx-p-lead">
        Your hospital gave you a discharge code when you left. It opens your
        profile, the notes from your doctor, and your recovery check-ins.
      </p>
      <form className="rx-p-form" onSubmit={submit}>
        <div className="rx-p-field">
          <label htmlFor="rx-hospital">Your hospital</label>
          <select
            id="rx-hospital"
            className="rx-p-select"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
          >
            <option value="">Choose a hospital</option>
            {hospitals.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="rx-p-field">
          <label htmlFor="rx-code">Discharge code</label>
          <div className="rx-p-code">
            <KeyRound size={20} aria-hidden="true" />
            <input
              id="rx-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              maxLength={8}
              pattern="[A-Za-z]{3}-[0-9]{4}"
              placeholder="ABC-1234"
              value={code}
              onChange={(e) => {
                setCode(formatCode(e.target.value));
                if (error) setError("");
              }}
              aria-describedby="rx-code-help"
              required
            />
          </div>
          <small id="rx-code-help">
            Enter the three letters and four numbers printed on your discharge
            letter.
          </small>
        </div>
        <label className="rx-p-consent">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I agree to share my readings and answers with my care team at this
            hospital for the 30 days after discharge. I can stop at any time.
          </span>
        </label>
        {error && (
          <p className="rx-p-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="rx-p-btn primary">
          Open my profile
        </button>
      </form>
      <p className="rx-p-fine">
        Every patient here is synthetic; the demo codes are in the runbook.
        Relay describes readings; it does not diagnose.
      </p>
    </>
  );
}

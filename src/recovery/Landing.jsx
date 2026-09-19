import { Activity } from "lucide-react";
import { go } from "./useRecovery.js";

// Remembering the entry choice means a mid-demo reload lands back in the app,
// not on this page. Read again in Root.jsx.
export const ROLE_KEY = "rx-role";

function choose(role) {
  sessionStorage.setItem(ROLE_KEY, role);
  go(`/${role}`);
}

// The root URL used to drop straight into the clinician watchlist. This is the first
// thing a judge sees, so the honest strip is as prominent as the entry buttons.
export default function Landing() {
  return (
    <div className="rx rx-landing">
      <main className="rx-landing-inner">
        <span className="rx-brand rx-landing-brand">
          <span className="rx-brand-mark">
            <Activity size={20} strokeWidth={2.4} />
          </span>
          relay
        </span>
        {/* The one-sentence version from docs/PITCH.md, verbatim. */}
        <h1 className="rx-landing-title">
          Relay watches recovery between visits, and tells a clinician what
          changed for this specific patient — never what it means.
        </h1>

        <div className="rx-landing-choices">
          <button
            type="button"
            className="rx-landing-btn"
            onClick={() => choose("patient")}
          >
            <strong>I am a patient</strong>
            <span>
              See what your care team is watching and answer their questions.
            </span>
          </button>
          <button
            type="button"
            className="rx-landing-btn"
            onClick={() => choose("doctor")}
          >
            <strong>I am a clinician</strong>
            <span>Open the recovery watchlist and review what changed.</span>
          </button>
        </div>

        <section className="rx-landing-honest" aria-label="About this demo">
          <h2>Read this first</h2>
          <ul>
            <li>
              Every patient here is <strong>synthetic</strong>. There is no real
              patient data in this demo.
            </li>
            <li>
              The thresholds are <strong>demo settings</strong>, not clinically
              validated.
            </li>
            <li>
              Relay is <strong>not a medical device</strong>. It describes what
              changed; it does not diagnose or advise treatment.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

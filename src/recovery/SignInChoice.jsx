import { Activity, ArrowRight, Stethoscope, UserRound } from "lucide-react";
import { LANDING_URL } from "./landingUrl.js";

export default function SignInChoice() {
  return (
    <main className="rx-auth-page">
      <div className="rx-auth-shell rx-auth-entry">
        <a
          className="rx-brand rx-auth-brand"
          href={LANDING_URL}
          aria-label="Relay home page"
        >
          <span className="rx-brand-mark" aria-hidden="true">
            <Activity size={19} strokeWidth={2.4} />
          </span>
          <span className="rx-brand-word">Relay</span>
        </a>
        <section className="rx-auth-card" aria-labelledby="signin-choice-title">
          <h1 id="signin-choice-title">Sign in to Relay</h1>
          <p>Choose your workspace.</p>
          <div className="rx-auth-entry-options">
            <a className="rx-p-btn" href="#/login">
              <Stethoscope size={22} aria-hidden="true" />
              <span>
                Doctor <small>Review patients and check-ins</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="rx-p-btn" href="#/patient">
              <UserRound size={22} aria-hidden="true" />
              <span>
                Patient <small>Open your recovery profile</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

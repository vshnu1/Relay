import {
  Activity,
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Watch,
} from "lucide-react";
import { go } from "./useRecovery.js";

export const ROLE_KEY = "rx-role";

function choose(role) {
  sessionStorage.setItem(ROLE_KEY, role);
  go(`/${role}`);
}

const PREVIEW_PATIENTS = [
  {
    name: "Daniel Reyes",
    detail: "Heart failure · day 16",
    status: "Review",
    tone: "review",
    score: "3 / 5",
  },
  {
    name: "Priya Nair",
    detail: "Abdominal surgery · day 6",
    status: "Review",
    tone: "review",
    score: "2 / 4",
  },
  {
    name: "Maya Okafor",
    detail: "Pneumonia · day 9",
    status: "Waiting",
    tone: "context",
    score: "4 / 4",
  },
];

export default function Landing() {
  return (
    <main className="rx-landing">
      <nav className="rx-landing-nav" aria-label="Relay">
        <a className="rx-brand" href="#/">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          Relay
        </a>
        <div className="rx-landing-links">
          <a href="#rx-how">How it works</a>
          <a href="#rx-care">For care teams</a>
          <a href="#/patient" onClick={() => choose("patient")}>
            For patients
          </a>
        </div>
        <a className="rx-btn primary" href="#/login">
          Sign in <ArrowRight size={16} />
        </a>
      </nav>

      <section className="rx-landing-hero">
        <div className="rx-landing-copy">
          <span className="rx-eyebrow">
            <Sparkles size={14} /> Meet Relay · recovery support after discharge
          </span>
          <h1>
            Recovery support
            <em> that follows patients home.</em>
          </h1>
          <p>
            After discharge, Relay turns everyday wearable readings into a calm,
            shared picture of what is changing at home. Patients get a simple
            check-in; care teams get the context they need to follow up.
          </p>
          <div className="rx-landing-actions">
            <a className="rx-btn primary tall" href="#/login">
              Enter the care team workspace <ArrowRight size={17} />
            </a>
            <a
              className="rx-btn tall"
              href="#/patient"
              onClick={() => choose("patient")}
            >
              See the patient journey
            </a>
          </div>
          <div className="rx-landing-proof">
            <span>
              <CheckCircle2 size={16} /> Synthetic demo data
            </span>
            <span>
              <ShieldCheck size={16} /> Consent-led sharing
            </span>
            <span>
              <HeartPulse size={16} /> Clinician review stays human
            </span>
          </div>
        </div>

        <div className="rx-landing-stage" aria-label="Recovery watch preview">
          <div className="rx-stage-glow" />
          <div className="rx-stage-window">
            <div className="rx-stage-topbar">
              <div className="rx-stage-brand">
                <span className="rx-stage-dot" /> Relay
              </div>
              <span className="rx-stage-live">
                <i /> Live demo
              </span>
            </div>
            <div className="rx-stage-heading">
              <div>
                <span className="rx-stage-kicker">Tuesday, September 19</span>
                <h2>Recovery watch</h2>
                <p>Two patients need your review today.</p>
              </div>
              <div className="rx-stage-avatar">DR</div>
            </div>
            <div className="rx-stage-metrics">
              <div>
                <strong>2</strong>
                <span>Needs review</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Waiting on patient</span>
              </div>
              <div>
                <strong>5</strong>
                <span>Monitoring quietly</span>
              </div>
            </div>
            <div className="rx-stage-list">
              {PREVIEW_PATIENTS.map((patient) => (
                <div className="rx-stage-row" key={patient.name}>
                  <div className="rx-stage-person">
                    <span className={`rx-stage-status ${patient.tone}`} />
                    <span>
                      <strong>{patient.name}</strong>
                      <small>{patient.detail}</small>
                    </span>
                  </div>
                  <p>{patient.status}</p>
                  <span className="rx-stage-score">{patient.score}</span>
                </div>
              ))}
            </div>
            <div className="rx-stage-foot">
              <span>Updated just now</span>
              <span>All patients are synthetic</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rx-landing-band" id="rx-how">
        <div className="rx-landing-band-intro">
          <span className="rx-eyebrow">A shared next step</span>
          <h2>From a noisy data stream to a useful conversation.</h2>
        </div>
        <div className="rx-landing-steps">
          <article>
            <span>01</span>
            <Watch size={20} />
            <h3>Collect</h3>
            <p>
              Wearable readings arrive with device status and patient consent.
            </p>
          </article>
          <article>
            <span>02</span>
            <Activity size={20} />
            <h3>Make sense</h3>
            <p>Relay compares each patient with their own recent baseline.</p>
          </article>
          <article>
            <span>03</span>
            <HeartPulse size={20} />
            <h3>Follow through</h3>
            <p>
              A focused check-in adds context before a clinician reviews the
              handoff.
            </p>
          </article>
        </div>
      </section>

      <section className="rx-landing-callout" id="rx-care">
        <div>
          <span className="rx-eyebrow">
            Designed for the moment after discharge
          </span>
          <h2>Less dashboard hunting. More confident follow-up.</h2>
        </div>
        <p>
          Relay does not diagnose or recommend treatment. It surfaces persistent
          changes, captures the patient&apos;s context, and gives the care team
          a readable starting point for the next conversation.
        </p>
      </section>

      <footer className="rx-landing-footer">
        <span>Relay · recovery watch</span>
        <span>Hackathon prototype · Every patient is synthetic</span>
      </footer>
    </main>
  );
}

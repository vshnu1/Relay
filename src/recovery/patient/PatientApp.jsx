import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Home as HomeIcon,
  Sparkles,
  Watch,
} from "lucide-react";
import { ago } from "../format.js";
import Checkin from "./Checkin.jsx";
import Watching from "./Watching.jsx";
import Sharing from "./Sharing.jsx";

const TABS = [
  { id: "home", label: "Home", href: "#/patient", icon: HomeIcon },
  { id: "sharing", label: "Sharing", href: "#/patient/sharing", icon: Watch },
];

function Home({ patient: p }) {
  const watch = p.devices.watch;
  const changed = p.changedForPatient;
  const hasChange = changed.length > 0;
  return (
    <>
      <header className="rx-p-top">
        <div>
          <span className="rx-brand">
            <span className="rx-brand-mark">
              <Activity size={18} strokeWidth={2.4} />
            </span>
            relay
          </span>
          <span className="rx-p-greeting">{p.first}&apos;s recovery</span>
        </div>
        <a className="rx-p-help" href="#/patient/watching">
          Help
        </a>
      </header>
      <div className="rx-p-day">
        <span>
          Day {p.dayHome} of {p.windowDays} at home
        </span>
        <div aria-hidden="true">
          <i
            style={{
              width: `${Math.min(100, (p.dayHome / p.windowDays) * 100)}%`,
            }}
          />
        </div>
      </div>
      <section className="rx-p-card" aria-label="Today">
        {p.pending ? (
          <>
            <span className="rx-p-eyebrow">
              <Sparkles size={15} /> A quick check-in
            </span>
            <h1>Your care team wants a little context</h1>
            <p>
              Relay noticed a change in your usual readings. Your answers help
              your care team understand what may be going on.
            </p>
            <a className="rx-p-btn primary" href="#/patient/checkin">
              Answer questions <ArrowRight size={19} />
            </a>
          </>
        ) : (
          <>
            <span className="rx-p-eyebrow">
              <CircleCheck size={15} /> You&apos;re up to date
            </span>
            <h1>
              {hasChange
                ? "Your care team is keeping an eye on a change"
                : "Your readings look steady"}
            </h1>
            <p>
              {hasChange
                ? "You can add context any time. It will appear beside the readings your care team sees."
                : "Your care team can see your watch readings. We will let you know if they have questions."}
            </p>
            <a className="rx-p-btn" href="#/patient/checkin">
              Tell them how you feel <ArrowRight size={19} />
            </a>
          </>
        )}
      </section>
      <section
        className="rx-p-card rx-p-insight"
        aria-label="What Relay noticed"
      >
        <div className="rx-p-sectionhead">
          <div>
            <span className="rx-p-eyebrow">Your recovery picture</span>
            <h2>What Relay noticed</h2>
          </div>
          <a
            href="#/patient/watching"
            aria-label="Learn what Relay is watching"
          >
            <ChevronRight size={20} />
          </a>
        </div>
        {hasChange ? (
          <>
            <p className="rx-p-insight-lead">
              {changed.length} of the readings your care team watches have moved
              away from your usual range.
            </p>
            <div className="rx-p-signal-chips">
              {changed.slice(0, 3).map((s) => (
                <span key={s.id}>{s.plain}</span>
              ))}
            </div>
            <p className="rx-p-fine">
              A change is not a diagnosis. Your care team asks questions before
              deciding what it means.
            </p>
          </>
        ) : (
          <p className="rx-p-insight-lead">
            The readings your care team watches are close to what is usual for
            you.
          </p>
        )}
      </section>
      <section className="rx-p-card list" aria-label="Your watch">
        <div className="rx-p-status">
          {watch.sharing ? (
            <CheckCircle2 size={28} color="#2f7a62" aria-hidden="true" />
          ) : (
            <CircleAlert size={28} color="#8a6520" aria-hidden="true" />
          )}
          <div>
            <strong>
              {watch.sharing
                ? "Your watch is connected"
                : "Your watch is not sharing"}
            </strong>
            <span>
              {watch.sharing
                ? `Last synced ${ago(Date.now() - watch.lastSync)}`
                : "You paused it. Your care team sees nothing new."}
            </span>
          </div>
        </div>
        <a className="rx-p-rowlink" href="#/patient/watching">
          See what your care team is watching
          <ChevronRight size={20} aria-hidden="true" />
        </a>
      </section>
      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers.
      </p>
    </>
  );
}

export default function PatientApp({ patient, route }) {
  const page = ["checkin", "watching", "sharing"].includes(route[1])
    ? route[1]
    : "home";
  const focused = page === "checkin" || page === "watching";
  return (
    <div className="rx-patient">
      <div className="rx-phone">
        <main className="rx-p-screen">
          {page === "checkin" ? (
            <Checkin patient={patient} />
          ) : page === "watching" ? (
            <Watching patient={patient} />
          ) : page === "sharing" ? (
            <Sharing patient={patient} />
          ) : (
            <Home patient={patient} />
          )}
        </main>
        {!focused && (
          <nav className="rx-p-tabs" aria-label="Sections">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={t.href}
                aria-current={page === t.id ? "page" : undefined}
              >
                <t.icon size={23} aria-hidden="true" />
                {t.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

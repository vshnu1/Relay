import {
  Activity,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Home as HomeIcon,
  MessageSquare,
  Watch,
} from "lucide-react";
import { ago } from "../format.js";
import Checkin from "./Checkin.jsx";
import Watching from "./Watching.jsx";
import Sharing from "./Sharing.jsx";

const TABS = [
  { id: "home", label: "Home", href: "#/patient", icon: HomeIcon },
  {
    id: "checkin",
    label: "Questions",
    href: "#/patient/checkin",
    icon: MessageSquare,
  },
  { id: "sharing", label: "Sharing", href: "#/patient/sharing", icon: Watch },
];

function Home({ patient: p }) {
  const watch = p.devices.watch;
  return (
    <>
      <header className="rx-p-top">
        <span className="rx-brand">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          relay
        </span>
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
            <h1>Your care team has a few questions for you</h1>
            <p>It takes about two minutes. It is not a diagnosis.</p>
            <a className="rx-p-btn primary" href="#/patient/checkin">
              Answer now
            </a>
          </>
        ) : (
          <>
            <h1>Nothing is needed from you today</h1>
            <p>
              Your care team can see your watch readings. We will let you know
              if they have questions.
            </p>
            <a className="rx-p-btn" href="#/patient/checkin">
              Tell them how you feel
            </a>
          </>
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
          What is my care team watching?
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

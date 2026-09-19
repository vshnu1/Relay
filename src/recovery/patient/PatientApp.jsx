import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Home as HomeIcon,
  LineChart,
  MessageCircle,
  MessageSquare,
  Smartphone,
  UserRound,
} from "lucide-react";
import { ago, list } from "../format.js";
import {
  checkinDue,
  nextScheduledDay,
  notifications,
} from "../model/schedule.js";
import Checkin from "./Checkin.jsx";
import Watching from "./Watching.jsx";
import Sharing from "./Sharing.jsx";
import Profile from "./Profile.jsx";
import Connect from "./Connect.jsx";
import Metrics from "./Metrics.jsx";
import Assistant from "./Assistant.jsx";
import Journal from "./Journal.jsx";
import Care from "./Care.jsx";
import Insight from "./Insight.jsx";

const NAV = [
  { id: "home", label: "Home", href: "#/patient", icon: HomeIcon },
  {
    id: "readings",
    label: "My readings",
    href: "#/patient/readings",
    icon: LineChart,
  },
  {
    id: "checkin",
    label: "Check-in",
    href: "#/patient/checkin",
    icon: MessageSquare,
  },
  {
    id: "assistant",
    label: "Assistant",
    href: "#/patient/assistant",
    icon: MessageCircle,
  },
  {
    id: "journal",
    label: "Record something",
    href: "#/patient/journal",
    icon: BookOpen,
  },
  {
    id: "care",
    label: "Care team",
    href: "#/patient/care",
    icon: MessageSquare,
  },
  {
    id: "connect",
    label: "Your data",
    href: "#/patient/connect",
    icon: Smartphone,
  },
  { id: "profile", label: "Me", href: "#/patient/profile", icon: UserRound },
];

function phrase(s) {
  if (s.today === null) return "no reading yet today";
  if (s.towardDays === 0) return "about your usual";
  const word = s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase();
  return `${word} than usual for ${s.towardDays === 1 ? "a day" : `${s.towardDays} ${s.span}`}`;
}

function Home({ patient: p }) {
  const notes = notifications(p);
  const due = checkinDue(p);
  const next = nextScheduledDay(p.dayHome);
  const connected = Object.entries(p.devices).filter(
    ([id, d]) =>
      !["sensor", "manual", "phone"].includes(id) && d.connected !== false,
  );
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <div className="rx-p-hello">
        <h1>
          {greeting}, {p.first}
        </h1>
        <span>
          Day {p.dayHome} of {p.windowDays}
        </span>
      </div>
      <div className="rx-p-day">
        <span>Recovery after {p.profile.after}</span>
        <div aria-hidden="true">
          <i
            style={{
              width: `${Math.min(100, (p.dayHome / p.windowDays) * 100)}%`,
            }}
          />
        </div>
        <small>
          {due.due
            ? "A check-in is due today."
            : next
              ? `Your next check-in is on day ${next}.`
              : "Your check-ins are complete."}
        </small>
      </div>
      <div className="rx-p-home">
        <div className="rx-p-col">
          {notes.length ? (
            <section aria-label="For you today" className="rx-p-stack">
              {notes.map((n) => (
                <div key={n.id} className={`rx-p-notif ${n.kind}`}>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <a href={n.href}>{n.cta} →</a>
                </div>
              ))}
            </section>
          ) : (
            <section className="rx-p-card" aria-label="Today">
              <h2>Nothing is needed from you today</h2>
              <p>
                Your care team can see your readings. We will let you know if
                they have questions.
              </p>
            </section>
          )}
          <div className="rx-p-grid" aria-label="Quick actions">
            <a className="rx-p-action" href="#/patient/checkin">
              <MessageSquare size={22} aria-hidden="true" /> Check in
              <small>{p.profile.questions.length} questions, two minutes</small>
            </a>
            <a className="rx-p-action" href="#/patient/assistant">
              <MessageCircle size={22} aria-hidden="true" /> Talk it through
              <small>Answer by voice or chat</small>
            </a>
            <a className="rx-p-action" href="#/patient/journal">
              <BookOpen size={22} aria-hidden="true" /> Record something
              <small>A symptom, a medicine, anything odd</small>
            </a>
            <a className="rx-p-action" href="#/patient/readings">
              <LineChart size={22} aria-hidden="true" /> My readings
              <small>{p.counted.length} watched signals</small>
            </a>
          </div>
        </div>
        <div className="rx-p-col">
          <section className="rx-p-card list" aria-label="Your readings today">
            <h2>Your readings today</h2>
            {p.counted.map((s) => (
              <div className="rx-p-signal" key={s.id}>
                <div>
                  <strong>{s.plain}</strong>
                  <span
                    className={`rx-p-chip ${s.towardDays ? "changed" : ""}`}
                  >
                    {s.towardDays ? "Changed" : "Usual"}
                  </span>
                </div>
                <p>
                  {s.today === null
                    ? "No reading yet today."
                    : `${s.fmt(s.today)} ${s.unit}, ${phrase(s)}.`}
                </p>
              </div>
            ))}
            <a className="rx-p-rowlink" href="#/patient/readings">
              See all readings
              <ChevronRight size={20} aria-hidden="true" />
            </a>
          </section>
          <section className="rx-p-card list" aria-label="Your devices">
            <div className="rx-p-status">
              {connected.length ? (
                <CheckCircle2 size={28} color="#2f7a62" aria-hidden="true" />
              ) : (
                <CircleAlert size={28} color="#8a6520" aria-hidden="true" />
              )}
              <div>
                <strong>
                  {connected.length
                    ? `${list(connected.map(([, d]) => d.name))} connected`
                    : "No wearable connected"}
                </strong>
                <span>
                  {connected.length
                    ? `Last synced ${ago(Date.now() - Math.max(...connected.map(([, d]) => d.lastSync || 0)))}`
                    : "Connect one so your care team sees your readings."}
                </span>
              </div>
            </div>
            <a className="rx-p-rowlink" href="#/patient/connect">
              Connected data and imports
              <ChevronRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>
      </div>
      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers.
      </p>
    </>
  );
}

export default function PatientApp({ patient, route, onSignOut }) {
  const page = [
    "checkin",
    "watching",
    "sharing",
    "profile",
    "connect",
    "readings",
    "assistant",
    "journal",
    "care",
    "insight",
  ].includes(route[1])
    ? route[1]
    : "home";
  const current =
    page === "sharing"
      ? "connect"
      : page === "watching"
        ? "profile"
        : page === "insight"
          ? "care"
          : page;
  const due = checkinDue(patient);
  return (
    <div className="rx-doctor rx-pweb">
      <nav className="rx-side" aria-label="Sections">
        <a className="rx-brand" href="#/patient">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          relay
        </a>
        {NAV.map((t) => (
          <a
            key={t.id}
            className="rx-navlink"
            href={t.href}
            aria-current={current === t.id ? "page" : undefined}
          >
            <span>
              <t.icon size={16} aria-hidden="true" /> {t.label}
            </span>
            {t.id === "checkin" && due.due && (
              <span className="rx-count">1</span>
            )}
          </a>
        ))}
        <div className="rx-side-foot">
          <p>
            {patient.name}
            <br />
            Day {patient.dayHome} of {patient.windowDays}
          </p>
          <a href="#/patient/watching">What is watched</a>
          <button type="button" className="rx-textbtn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="rx-main">
        <div className="rx-p-screen">
          {page === "checkin" ? (
            <Checkin patient={patient} />
          ) : page === "watching" ? (
            <Watching patient={patient} />
          ) : page === "sharing" ? (
            <Sharing patient={patient} />
          ) : page === "profile" ? (
            <Profile patient={patient} onSignOut={onSignOut} />
          ) : page === "connect" ? (
            <Connect patient={patient} />
          ) : page === "readings" ? (
            <Metrics patient={patient} />
          ) : page === "assistant" ? (
            <Assistant patient={patient} />
          ) : page === "journal" ? (
            <Journal patient={patient} />
          ) : page === "care" ? (
            <Care patient={patient} />
          ) : page === "insight" ? (
            <Insight patient={patient} />
          ) : (
            <Home patient={patient} />
          )}
        </div>
      </main>
    </div>
  );
}

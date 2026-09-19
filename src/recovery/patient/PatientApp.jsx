import { useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Home as HomeIcon,
  LineChart,
  Mic,
  Smartphone,
  Users,
} from "lucide-react";
import { ago, list } from "../format.js";
import { checkinDue, nextScheduledDay } from "../model/schedule.js";
import Checkin from "./Checkin.jsx";
import Watching from "./Watching.jsx";
import Sharing from "./Sharing.jsx";
import Connect from "./Connect.jsx";
import Metrics from "./Metrics.jsx";
import Journal from "./Journal.jsx";
import Care from "./Care.jsx";
import Insight from "./Insight.jsx";
import HomeAlert from "./HomeAlert.jsx";
import HomeReadings from "./HomeReadings.jsx";
import HomeHospital from "./HomeHospital.jsx";

// Five places to go. Everything else is reached from inside one of them.
const NAV = [
  { id: "home", label: "Home", href: "#/patient", icon: HomeIcon },
  { id: "checkin", label: "Check-in", href: "#/patient/checkin", icon: Mic },
  {
    id: "readings",
    label: "Readings",
    href: "#/patient/readings",
    icon: LineChart,
  },
  { id: "care", label: "Care team", href: "#/patient/care", icon: Users },
  {
    id: "connect",
    label: "Your data",
    href: "#/patient/connect",
    icon: Smartphone,
  },
];

function Home({ patient: p }) {
  const due = checkinDue(p);
  const next = nextScheduledDay(p.dayHome);
  const connected = Object.entries(p.devices).filter(
    ([id, d]) =>
      !["sensor", "manual", "phone"].includes(id) && d.connected !== false,
  );
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const left = Math.max(0, p.windowDays - p.dayHome);
  return (
    <>
      <header className="rx-ph-top">
        <div>
          <span className="rx-ph-kicker">
            Recovering from {p.profile.after} · {p.hospital.split(", ")[0]}
          </span>
          <h1 className="rx-serif">
            {greeting}, {p.first}
          </h1>
        </div>
        <div className="rx-ph-progress">
          <div className="rx-ph-progress-labels">
            <strong>
              Day {p.dayHome} of {p.windowDays} at home
            </strong>
            <span>
              {left === 0
                ? "Last day"
                : `${left} ${left === 1 ? "day" : "days"} to go`}
            </span>
          </div>
          <div className="rx-ph-bar" aria-hidden="true">
            <i
              style={{
                width: `${Math.min(100, (p.dayHome / p.windowDays) * 100)}%`,
              }}
            />
          </div>
          <a className="rx-ph-device" href="#/patient/connect">
            {connected.length ? (
              <>
                <CheckCircle2 size={14} color="#2f7a62" aria-hidden="true" />
                {list(connected.map(([, d]) => d.name))} connected · synced{" "}
                {ago(
                  Date.now() -
                    Math.max(...connected.map(([, d]) => d.lastSync || 0)),
                )}
              </>
            ) : (
              <>
                <CircleAlert size={14} color="#8a6520" aria-hidden="true" />
                No wearable connected · connect one
              </>
            )}
            {!due.due && next && ` · next check-in day ${next}`}
          </a>
        </div>
      </header>

      <HomeAlert patient={p} />

      <div className="rx-ph-lanes">
        <HomeReadings patient={p} />
        <HomeHospital patient={p} />
      </div>

      <p className="rx-p-fine">
        Feeling very unwell? Follow the emergency instructions in your discharge
        papers. A change in a reading is not a diagnosis; it is a reason for
        your care team to look.
      </p>
    </>
  );
}

export default function PatientApp({ patient, route, onSignOut }) {
  const page = [
    "checkin",
    "watching",
    "sharing",
    "connect",
    "readings",
    "journal",
    "care",
    "insight",
  ].includes(route[1])
    ? route[1]
    : route[1] === "assistant"
      ? "checkin"
      : "home";
  const current =
    page === "sharing"
      ? "connect"
      : page === "watching" || page === "journal"
        ? "readings"
        : page === "insight"
          ? "checkin"
          : page;
  const due = checkinDue(patient);
  return (
    <div className="rx-doctor rx-pweb">
      <nav className="rx-side" aria-label="Sections">
        <a className="rx-brand" href="#/patient">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          Relay
        </a>
        <span className="rx-side-heading">Patient workspace</span>
        {NAV.map((t) => (
          <a
            key={t.id}
            className="rx-navlink"
            href={t.href}
            aria-current={current === t.id ? "page" : undefined}
          >
            <span className="rx-navlink-label">
              <t.icon size={16} aria-hidden="true" /> {t.label}
            </span>
            {t.id === "checkin" && due.due && (
              <span className="rx-count" title="Check-in due">
                1
              </span>
            )}
          </a>
        ))}
        <div className="rx-side-foot">
          <button type="button" className="rx-textbtn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="rx-main">
        <div className="rx-p-screen">
          {page === "checkin" ? (
            <Checkin key={patient.id} patient={patient} />
          ) : page === "watching" ? (
            <Watching patient={patient} />
          ) : page === "sharing" ? (
            <Sharing patient={patient} />
          ) : page === "connect" ? (
            <Connect patient={patient} />
          ) : page === "readings" ? (
            <Metrics patient={patient} />
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

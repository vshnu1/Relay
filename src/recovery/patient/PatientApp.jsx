import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Home as HomeIcon,
  LineChart,
  Mic,
  Smartphone,
  Users,
} from "lucide-react";
import { ago, dateLong, list } from "../format.js";
import {
  checkinDue,
  nextScheduledDay,
  notifications,
} from "../model/schedule.js";
import Checkin from "./Checkin.jsx";
import Watching from "./Watching.jsx";
import Sharing from "./Sharing.jsx";
import Connect from "./Connect.jsx";
import Metrics from "./Metrics.jsx";
import Journal from "./Journal.jsx";
import Care from "./Care.jsx";
import Insight from "./Insight.jsx";
import { useAnalysis } from "./useAnalysis.js";
import { describeAnalysis } from "../model/mlClient.js";

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

const when = (t) =>
  new Date(t).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Home({ patient: p }) {
  const notes = notifications(p);
  const { run, busy, error } = useAnalysis(p);
  const due = checkinDue(p);
  const next = nextScheduledDay(p.dayHome);
  const connected = Object.entries(p.devices).filter(
    ([id, d]) =>
      !["sensor", "manual", "phone"].includes(id) && d.connected !== false,
  );
  const followUp = [...p.appointments]
    .filter((a) => a.t > Date.now())
    .sort((a, b) => a.t - b.t)[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <header className="rx-p-top">
        <div>
          <span className="rx-p-kicker">
            Day {p.dayHome} of {p.windowDays} · after {p.profile.after} ·{" "}
            {p.hospital}
          </span>
          <h1>
            {greeting}, {p.first}
          </h1>
        </div>
        <div className="rx-p-day compact">
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
                ? `Next check-in on day ${next}.`
                : "Check-ins complete."}
          </small>
        </div>
      </header>

      {notes.length ? (
        <div className="rx-p-alerts" aria-label="For you today">
          {notes.map((n) => (
            <div key={n.id} className={`rx-p-notif ${n.kind}`}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <a href={n.href}>{n.cta} →</a>
            </div>
          ))}
        </div>
      ) : (
        <p className="rx-p-quiet">
          <CheckCircle2 size={16} aria-hidden="true" /> Nothing is needed from
          you today. Your care team can see your readings.
        </p>
      )}

      <div className="rx-p-home">
        <div className="rx-p-col">
          <section className="rx-p-card" aria-label="From your hospital">
            <h2>From {p.hospital}</h2>
            <p className="rx-p-meta">
              Discharged {dateLong(p.dischargedAt)} after a {p.stayDays}-day
              stay. Responsible clinician: {p.clinician}.
            </p>
            <h3 className="rx-p-h3">Doctor's notes</h3>
            {p.notes ? (
              <p className="rx-serif rx-p-notes">{p.notes}</p>
            ) : (
              <p className="rx-p-empty">
                Not written yet. They appear here when your care team adds them.
              </p>
            )}
            <h3 className="rx-p-h3">Prescriptions</h3>
            {p.medications.length ? (
              <ul className="rx-p-bullets">
                {p.medications.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="rx-p-empty">None listed yet.</p>
            )}
            <h3 className="rx-p-h3">Follow-up</h3>
            {followUp ? (
              <p className="rx-p-appt">
                <CalendarDays size={15} aria-hidden="true" />
                <span>
                  <strong>{when(followUp.t)}</strong> · {followUp.with},{" "}
                  {followUp.where}
                </span>
              </p>
            ) : (
              <p className="rx-p-empty">Not scheduled yet.</p>
            )}
            <a className="rx-p-rowlink" href="#/patient/care">
              Messages, appointments and reports
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </section>
        </div>
        <div className="rx-p-col">
          <section className="rx-p-card list" aria-label="Your readings today">
            <h2>Your readings today</h2>
            {p.counted.map((s) => (
              <div className="rx-p-row" key={s.id}>
                <span>{s.plain}</span>
                <strong>
                  {s.today === null ? "—" : `${s.fmt(s.today)} ${s.unit}`}
                </strong>
                <span className={`rx-p-chip ${s.towardDays ? "changed" : ""}`}>
                  {s.today === null
                    ? "No reading"
                    : s.towardDays
                      ? "Changed"
                      : "Usual"}
                </span>
              </div>
            ))}
            <div className="rx-p-row model">
              <span>Relay's model</span>
              <p>
                {p.analysis
                  ? describeAnalysis(p.analysis, p.profile)
                  : "Not scored yet. Scoring compares your recent readings with your own usual."}
              </p>
              <button
                type="button"
                className="rx-p-btn small"
                disabled={busy}
                onClick={() => run(p.answered ? p.answered.answers : null)}
              >
                {busy ? "Scoring…" : p.analysis ? "Score again" : "Score"}
              </button>
            </div>
            {error && (
              <p className="rx-p-error" role="alert">
                {error}
              </p>
            )}
            <a className="rx-p-rowlink" href="#/patient/readings">
              See the charts
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </section>
          <section className="rx-p-card list" aria-label="Your devices">
            <div className="rx-p-status">
              {connected.length ? (
                <CheckCircle2 size={20} color="#2f7a62" aria-hidden="true" />
              ) : (
                <CircleAlert size={20} color="#8a6520" aria-hidden="true" />
              )}
              <div>
                <strong>
                  {connected.length
                    ? `${list(connected.map(([, d]) => d.name))} connected`
                    : "No wearable connected"}
                </strong>
                <span>
                  {connected.length
                    ? `Synced ${ago(Date.now() - Math.max(...connected.map(([, d]) => d.lastSync || 0)))}`
                    : "Connect one so your care team sees your readings."}
                </span>
              </div>
              <a href="#/patient/connect" aria-label="Your data">
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            </div>
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
              <span className="rx-count" title="Check-in due">
                1
              </span>
            )}
          </a>
        ))}
        <div className="rx-side-foot">
          <p>
            {patient.name}
            <br />
            Day {patient.dayHome} of {patient.windowDays}
          </p>
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

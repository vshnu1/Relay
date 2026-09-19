import {
  Activity,
  House,
  ListChecks,
  LogOut,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import DoctorHome from "./DoctorHome.jsx";
import IntendedUse from "./IntendedUse.jsx";
import Watchlist from "./Watchlist.jsx";
import PatientOverview from "./PatientOverview.jsx";
import Profiles from "./Profiles.jsx";
import Assurance from "./Assurance.jsx";
import Messages from "./Messages.jsx";

export default function DoctorApp({
  route,
  cohort,
  sourceLabel,
  canSignOut,
  onSignOut,
}) {
  const page =
    route[1] === "p"
      ? "patient"
      : route[1] === "messages"
        ? "messages"
        : route[1] === "profiles"
          ? "profiles"
          : route[1] === "watchlist"
            ? "watchlist"
            : route[1] === "assurance"
              ? "assurance"
              : "home";
  const reviewCount = cohort.filter((p) => p.group === "review").length;
  const unreadCount = cohort.reduce(
    (n, p) =>
      n +
      (p.messages || []).filter((m) => m.by === "patient" && !m.readAt).length,
    0,
  );
  return (
    <div className="rx-doctor">
      <a className="rx-skip" href="#rx-main">
        Skip to main content
      </a>
      <nav className="rx-side" aria-label="Workspace">
        <a className="rx-brand" href="#/doctor">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          Relay
        </a>
        <span className="rx-side-heading">Care team</span>
        <a
          className="rx-navlink"
          href="#/doctor"
          aria-current={page === "home" ? "page" : undefined}
        >
          <span className="rx-navlink-label">
            <House size={16} aria-hidden="true" /> Home
          </span>
        </a>
        <a
          className="rx-navlink"
          href="#/doctor/watchlist"
          aria-current={
            page === "watchlist" || page === "patient" ? "page" : undefined
          }
        >
          <span className="rx-navlink-label">
            <ListChecks size={16} aria-hidden="true" /> Recovery watch
          </span>
          {reviewCount > 0 && <span className="rx-count">{reviewCount}</span>}
        </a>
        <a
          className="rx-navlink"
          href="#/doctor/messages"
          aria-current={page === "messages" ? "page" : undefined}
        >
          <span className="rx-navlink-label">
            <MessageSquare size={16} aria-hidden="true" /> Messages
          </span>
          {unreadCount > 0 && (
            <span className="rx-count" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
        </a>
        <a
          className="rx-navlink"
          href="#/doctor/profiles"
          aria-current={page === "profiles" ? "page" : undefined}
        >
          <span className="rx-navlink-label">
            <SlidersHorizontal size={16} aria-hidden="true" /> Watch profiles
          </span>
        </a>
        <a
          className="rx-navlink"
          href="#/doctor/assurance"
          aria-current={page === "assurance" ? "page" : undefined}
        >
          <span className="rx-navlink-label">
            <ShieldCheck size={16} aria-hidden="true" /> Security
          </span>
        </a>
        {canSignOut && (
          <div className="rx-side-foot">
            <button
              type="button"
              className="rx-navlink rx-signout-link"
              onClick={onSignOut}
            >
              <span className="rx-navlink-label">
                <LogOut size={16} aria-hidden="true" /> Sign out
              </span>
            </button>
          </div>
        )}
      </nav>
      <main className="rx-main" id="rx-main" tabIndex={-1}>
        <IntendedUse />
        {page === "patient" ? (
          <PatientOverview key={route[2]} id={route[2]} />
        ) : page === "messages" ? (
          <Messages cohort={cohort} selectedId={route[2]} />
        ) : page === "assurance" ? (
          <Assurance />
        ) : page === "profiles" ? (
          <Profiles />
        ) : page === "watchlist" ? (
          <Watchlist cohort={cohort} />
        ) : (
          <DoctorHome cohort={cohort} sourceLabel={sourceLabel} />
        )}
      </main>
    </div>
  );
}

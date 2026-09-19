import {
  Activity,
  House,
  KeyRound,
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
import EmergencyAccess, { OutsideCareTeam } from "./EmergencyAccess.jsx";
import { useCareTeam } from "../model/careTeam.js";

export default function DoctorApp({
  route,
  cohort: ward,
  sourceLabel,
  canSignOut,
  onSignOut,
}) {
  // An account assigned to a care team works with that team's patients, plus any
  // record it has open under emergency access. Every screen below gets that list,
  // not the ward. The server enforces the same rule on what it will serve.
  const care = useCareTeam(ward);
  const cohort = care.visible;
  const locked =
    route[1] === "p" ? care.outside.find((p) => p.id === route[2]) : null;
  const page =
    route[1] === "p"
      ? "patient"
      : route[1] === "emergency"
        ? "emergency"
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
        {care.scoped && <span className="rx-side-team">{care.team}</span>}
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
        {care.scoped && (
          <a
            className="rx-navlink"
            href="#/doctor/emergency"
            aria-current={page === "emergency" ? "page" : undefined}
          >
            <span className="rx-navlink-label">
              <KeyRound size={16} aria-hidden="true" /> Emergency access
            </span>
            {care.grants.length > 0 && (
              <span
                className="rx-side-dot"
                role="img"
                aria-label={`${care.grants.length} open`}
              />
            )}
          </a>
        )}
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
        {locked ? (
          <OutsideCareTeam patient={locked} team={care.team} />
        ) : page === "patient" ? (
          <PatientOverview key={route[2]} id={route[2]} />
        ) : page === "emergency" ? (
          <EmergencyAccess care={care} cohort={ward} selectedId={route[2]} />
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

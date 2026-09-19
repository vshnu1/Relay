import {
  Activity,
  House,
  ListChecks,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import DoctorHome from "./DoctorHome.jsx";
import IntendedUse from "./IntendedUse.jsx";
import Watchlist from "./Watchlist.jsx";
import PatientOverview from "./PatientOverview.jsx";
import Profiles from "./Profiles.jsx";
import Assurance from "./Assurance.jsx";

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
      : route[1] === "profiles"
        ? "profiles"
        : route[1] === "watchlist"
          ? "watchlist"
          : route[1] === "assurance"
            ? "assurance"
            : "home";
  const reviewCount = cohort.filter((p) => p.group === "review").length;
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
          <button
            type="button"
            className="rx-navlink rx-signout-link"
            onClick={onSignOut}
          >
            <span className="rx-navlink-label">
              <LogOut size={16} aria-hidden="true" /> Sign out
            </span>
          </button>
        )}
      </nav>
      <main className="rx-main" id="rx-main" tabIndex={-1}>
        <IntendedUse />
        {page === "patient" ? (
          <PatientOverview key={route[2]} id={route[2]} />
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

import { Activity, House, ListChecks, SlidersHorizontal } from "lucide-react";
import DoctorHome from "./DoctorHome.jsx";
import Watchlist from "./Watchlist.jsx";
import PatientOverview from "./PatientOverview.jsx";
import Profiles from "./Profiles.jsx";

export default function DoctorApp({ route, cohort, sourceLabel }) {
  const page =
    route[1] === "p"
      ? "patient"
      : route[1] === "profiles"
        ? "profiles"
        : route[1] === "watchlist"
          ? "watchlist"
          : "home";
  const reviewCount = cohort.filter((p) => p.group === "review").length;
  return (
    <div className="rx-doctor">
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
        <div className="rx-side-foot">
          <p>Demo workspace</p>
          <small>Synthetic patient records</small>
        </div>
      </nav>
      <main className="rx-main">
        {page === "patient" ? (
          <PatientOverview key={route[2]} id={route[2]} />
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

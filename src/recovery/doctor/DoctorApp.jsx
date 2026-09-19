import { Activity } from "lucide-react";
import Watchlist from "./Watchlist.jsx";
import PatientOverview from "./PatientOverview.jsx";
import Profiles from "./Profiles.jsx";

export default function DoctorApp({ route, cohort }) {
  const page =
    route[1] === "p"
      ? "patient"
      : route[1] === "profiles"
        ? "profiles"
        : "watchlist";
  const waiting = cohort.filter((p) => p.group === "review").length;
  return (
    <div className="rx-doctor">
      <nav className="rx-side" aria-label="Workspace">
        <a className="rx-brand" href="#/">
          <span className="rx-brand-mark">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          relay
        </a>
        <a
          className="rx-navlink"
          href="#/doctor"
          aria-current={page !== "profiles" ? "page" : undefined}
        >
          Watchlist
          {waiting > 0 && <span className="rx-count">{waiting}</span>}
        </a>
        <a
          className="rx-navlink"
          href="#/doctor/profiles"
          aria-current={page === "profiles" ? "page" : undefined}
        >
          Watch profiles
        </a>
        <div className="rx-side-foot">
          <p>Demo workspace. Every patient is synthetic.</p>
          {/* A full navigation, not a hash change: the classic app ships its own global styles. */}
          <a
            href="#/classic"
            onClick={(e) => {
              e.preventDefault();
              location.hash = "#/classic";
              location.reload();
            }}
          >
            Open the classic workspace
          </a>
        </div>
      </nav>
      <main className="rx-main">
        {page === "patient" ? (
          <PatientOverview key={route[2]} id={route[2]} />
        ) : page === "profiles" ? (
          <Profiles />
        ) : (
          <Watchlist cohort={cohort} />
        )}
      </main>
    </div>
  );
}

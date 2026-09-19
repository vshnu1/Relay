import { useEffect, useState } from "react";
import { useCohort, useRecovery, useRoute, go } from "./useRecovery.js";
import DoctorApp from "./doctor/DoctorApp.jsx";
import PatientApp from "./patient/PatientApp.jsx";
import Landing, { ROLE_KEY } from "./Landing.jsx";
import "./recovery.css";

// The bar above the product is demo scaffolding: it lets one browser play both roles.
export default function Root() {
  const route = useRoute();
  const cohort = useCohort();
  const { sourceLabel } = useRecovery();
  const [chosen, setChosen] = useState(() =>
    sessionStorage.getItem("rx-acting"),
  );
  const section = route[0];
  // Empty hash is the entry point. A returning visitor goes straight to the role they
  // already picked, so a mid-demo reload never bounces them back to the landing page.
  const savedRole = section ? null : sessionStorage.getItem(ROLE_KEY);
  const returning = savedRole === "patient" || savedRole === "doctor";
  useEffect(() => {
    if (returning) go(`/${savedRole}`);
  }, [returning, savedRole]);
  const isPatient = section === "patient";
  // Pin the identity once resolved. Otherwise answering the questions would hand the
  // screen to the next patient who has some waiting, in the middle of the flow.
  useEffect(() => {
    if (!chosen && cohort.length)
      setChosen((cohort.find((p) => p.pending) || cohort[0]).id);
  }, [chosen, cohort.length]);
  if (!section) return returning ? null : <Landing />;
  if (!cohort.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  // Default to someone with questions waiting, so the demo loop starts in the right place.
  const acting =
    cohort.find((p) => p.id === chosen) ||
    cohort.find((p) => p.pending) ||
    cohort[0];
  return (
    <div className="rx">
      <div className="rx-demobar">
        <span className="rx-demobar-label">Relay demo</span>
        <nav className="rx-switch" aria-label="Demo role">
          <a href="#/doctor" aria-current={isPatient ? undefined : "page"}>
            Doctor view
          </a>
          <a href="#/patient" aria-current={isPatient ? "page" : undefined}>
            Patient view
          </a>
        </nav>
        <div className="rx-demobar-right">
          {isPatient && (
            <label>
              Signed in as
              <select
                value={acting.id}
                onChange={(e) => {
                  sessionStorage.setItem("rx-acting", e.target.value);
                  setChosen(e.target.value);
                }}
              >
                {cohort.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.pending ? " (questions waiting)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="rx-live">
            <i aria-hidden="true" />
            {sourceLabel}
          </span>
        </div>
      </div>
      {isPatient ? (
        <PatientApp key={acting.id} patient={acting} route={route} />
      ) : (
        <DoctorApp route={route} cohort={cohort} />
      )}
    </div>
  );
}

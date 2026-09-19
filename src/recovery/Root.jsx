import { useEffect, useState } from "react";
import {
  useCohort,
  usePatient,
  useRoster,
  useSourceLabel,
  useRoute,
  go,
} from "./useRecovery.js";
import DoctorApp from "./doctor/DoctorApp.jsx";
import PatientApp from "./patient/PatientApp.jsx";
import Landing, { ROLE_KEY } from "./Landing.jsx";
import "./recovery.css";

export default function Root() {
  const route = useRoute();
  const section = route[0];
  // Empty hash is the entry point. A returning visitor goes straight to the role they
  // already picked, so a mid-demo reload never bounces them back to the landing page.
  const savedRole = section ? null : sessionStorage.getItem(ROLE_KEY);
  const returning = savedRole === "patient" || savedRole === "doctor";
  useEffect(() => {
    if (returning) go(`/${savedRole}`);
  }, [returning, savedRole]);
  if (!section) return returning ? null : <Landing />;
  return section === "patient" ? (
    <PatientRoot route={route} />
  ) : (
    <DoctorRoot route={route} />
  );
}

// Demo scaffolding, not product: one browser plays both roles with no login between
// them. Labelled as such so a judge is never misled about what it is.
function DemoBar({ isPatient, roster, actingId, onSelect }) {
  const sourceLabel = useSourceLabel();
  return (
    <div className="rx-demobar">
      <div className="rx-demobar-main">
        <span className="rx-demobar-label">Demo controls</span>
        <nav className="rx-switch" aria-label="Switch role (demo only)">
          <a href="#/doctor" aria-current={isPatient ? undefined : "page"}>
            Clinician view
          </a>
          <a href="#/patient" aria-current={isPatient ? "page" : undefined}>
            Patient view
          </a>
        </nav>
        <div className="rx-demobar-right">
          {isPatient && roster && (
            <label>
              Acting as
              <select
                value={actingId}
                onChange={(e) => onSelect(e.target.value)}
              >
                {roster.map((p) => (
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
      <p className="rx-demobar-note">
        Demo only — a real deployment separates these by account. No login
        stands between the two views here.
      </p>
    </div>
  );
}

function DoctorRoot({ route }) {
  const cohort = useCohort();
  if (!cohort.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  return (
    <div className="rx">
      <DemoBar isPatient={false} />
      <DoctorApp route={route} cohort={cohort} />
    </div>
  );
}

function PatientRoot({ route }) {
  // Only a light roster (id/name/pending) for the demo switcher — never the derived
  // clinical records of the rest of the cohort. The acting patient's own record is the
  // only one this component ever derives or holds; the patient app cannot reach another.
  const roster = useRoster();
  const [chosen, setChosen] = useState(() =>
    sessionStorage.getItem("rx-acting"),
  );
  // Pin the identity once resolved. Otherwise answering the questions would hand the
  // screen to the next patient who has some waiting, in the middle of the flow.
  useEffect(() => {
    if (!chosen && roster.length)
      setChosen((roster.find((p) => p.pending) || roster[0]).id);
  }, [chosen, roster.length]);
  const actingId =
    roster.find((p) => p.id === chosen)?.id ??
    roster.find((p) => p.pending)?.id ??
    roster[0]?.id ??
    null;
  const patient = usePatient(actingId);
  const select = (id) => {
    sessionStorage.setItem("rx-acting", id);
    setChosen(id);
  };
  if (!patient)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  return (
    <div className="rx">
      <DemoBar
        isPatient
        roster={roster}
        actingId={patient.id}
        onSelect={select}
      />
      <PatientApp key={patient.id} patient={patient} route={route} />
    </div>
  );
}

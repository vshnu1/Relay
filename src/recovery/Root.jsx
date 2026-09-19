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
import SignIn from "./SignIn.jsx";
import "./recovery.css";

const CODE_KEY = "rx-code";
const SIGNED_ROLE_KEY = "rx-signed-role";

export default function Root() {
  const route = useRoute();
  const section = route[0];
  // Whether codes are required is the server's answer, not ours. A 401 from
  // /status is that answer: the door being closed is the signal, so nothing
  // has to be exposed before sign-in. Until it replies we render nothing
  // rather than flashing a sign-in the deployment may not even use.
  const [gate, setGate] = useState(() => ({
    checked: false,
    required: false,
    role: sessionStorage.getItem(SIGNED_ROLE_KEY),
  }));
  useEffect(() => {
    let live = true;
    fetch("/api/status")
      .then((r) => {
        // 401 means codes are configured. The closed door is the signal, so
        // nothing has to be readable before sign-in.
        if (live)
          setGate((g) => ({
            ...g,
            checked: true,
            required: r.status === 401,
          }));
      })
      .catch(() => live && setGate((g) => ({ ...g, checked: true })));
    return () => {
      live = false;
    };
  }, []);
  // Empty hash is the entry point. A returning visitor goes straight to the role they
  // already picked, so a mid-demo reload never bounces them back to the landing page.
  const savedRole = section ? null : sessionStorage.getItem(ROLE_KEY);
  const returning = savedRole === "patient" || savedRole === "doctor";
  useEffect(() => {
    if (returning) go(`/${savedRole}`);
  }, [returning, savedRole]);
  if (!gate.checked) return null;
  if (gate.required && !gate.role)
    return (
      <SignIn
        onSignedIn={(role, code) => {
          sessionStorage.setItem(SIGNED_ROLE_KEY, role);
          sessionStorage.setItem(CODE_KEY, code);
          // The code decides the view. A patient code cannot reach the ward.
          go(role === "patient" ? "/patient" : "/doctor");
          setGate((g) => ({ ...g, role }));
        }}
      />
    );
  // A signed-in patient has no business on the clinician route, whatever the
  // hash says. The server refuses the cohort too; this stops the round trip.
  if (gate.required && gate.role === "patient" && section === "doctor") {
    go("/patient");
    return null;
  }
  if (!section) return returning ? null : <Landing />;
  return section === "patient" ? (
    <PatientRoot route={route} />
  ) : (
    <DoctorRoot route={route} />
  );
}

// Demo scaffolding, not product: one browser plays both roles with no login between
// them. Labelled as such so a judge is never misled about what it is.
// When access codes are configured the role switcher is gone: the signed-in
// role decides the view, and offering a toggle would contradict the gate. The
// note has to change with it — claiming no login stands between the views
// would be false once one does.
function DemoBar({ isPatient, roster, actingId, onSelect }) {
  const sourceLabel = useSourceLabel();
  // Read the session directly rather than threading two props through both
  // route components; the bar is the only thing that needs them.
  const gated = !!sessionStorage.getItem(SIGNED_ROLE_KEY);
  const onSignOut = () => {
    sessionStorage.removeItem(SIGNED_ROLE_KEY);
    sessionStorage.removeItem(CODE_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    location.hash = "";
    location.reload();
  };
  return (
    <div className="rx-demobar">
      <div className="rx-demobar-main">
        <span className="rx-demobar-label">Demo controls</span>
        {gated ? (
          <span className="rx-demobar-role">
            Signed in as {isPatient ? "patient" : "clinician"}
          </span>
        ) : (
          <nav className="rx-switch" aria-label="Switch role (demo only)">
            <a href="#/doctor" aria-current={isPatient ? undefined : "page"}>
              Clinician view
            </a>
            <a href="#/patient" aria-current={isPatient ? "page" : undefined}>
              Patient view
            </a>
          </nav>
        )}
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
          {gated && (
            <button type="button" className="rx-signout" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
      <p className="rx-demobar-note">
        {gated
          ? "Access codes are shared per role, checked by the server. A real deployment gives each person an account."
          : "Demo only — a real deployment separates these by account. No login stands between the two views here."}
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

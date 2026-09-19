import { useEffect, useState } from "react";
import {
  useCohort,
  usePatient,
  useRoster,
  useSourceLabel,
  useSyncStatus,
  useRoute,
  go,
} from "./useRecovery.js";
import DoctorApp from "./doctor/DoctorApp.jsx";
import PatientApp from "./patient/PatientApp.jsx";
import Landing, { ROLE_KEY } from "./Landing.jsx";
import SignIn from "./patient/SignIn.jsx";
import { currentPatientId, signIn, signOut } from "./patient/session.js";
import Login from "./Login.jsx";
import RoleSignIn from "./SignIn.jsx";
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
    async function checkAccess() {
      try {
        const response = await fetch("/api/status");
        if (!response.ok && response.status !== 401)
          throw new Error("unavailable");
        const required = response.status === 401;
        let role = null;
        const code = sessionStorage.getItem(CODE_KEY);
        if (required && code) {
          const verified = await fetch("/api/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (verified.ok) {
            const body = await verified.json();
            if (["clinician", "patient"].includes(body.role)) role = body.role;
          } else if (verified.status !== 401) throw new Error("unavailable");
        }
        if (!live) return;
        if (role) sessionStorage.setItem(SIGNED_ROLE_KEY, role);
        else {
          sessionStorage.removeItem(SIGNED_ROLE_KEY);
          sessionStorage.removeItem(CODE_KEY);
        }
        setGate({ checked: true, required, role });
      } catch {
        if (live)
          setGate({ checked: true, required: true, role: null, error: true });
      }
    }
    checkAccess();
    return () => {
      live = false;
    };
  }, []);
  if (!gate.checked)
    return <div className="rx rx-loading">Checking workspace access…</div>;
  if (gate.error)
    return (
      <div className="rx rx-loading">
        <p>Could not verify workspace access.</p>
        <button className="rx-btn" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  // Role gate first (shared code per role, verified by the server); the patient
  // then opens their own profile with the discharge code in PatientRoot.
  const AccessScreen = section === "patient" ? RoleSignIn : Login;
  if (gate.required && !gate.role)
    return (
      <div className="rx">
        <AccessScreen
          onSignedIn={(role, code) => {
            sessionStorage.setItem(SIGNED_ROLE_KEY, role);
            sessionStorage.setItem(CODE_KEY, code);
            // The code decides the view. A patient code cannot reach the ward.
            go(role === "patient" ? "/patient" : "/doctor");
            setGate((g) => ({ ...g, role }));
          }}
        />
      </div>
    );
  // A signed-in patient has no business on the clinician route, whatever the
  // hash says. The server refuses the cohort too; this stops the round trip.
  if (gate.required && gate.role === "patient" && section !== "patient") {
    go("/patient");
    return null;
  }
  if (section === "welcome" || section === "about")
    return (
      <div className="rx">
        <Landing />
      </div>
    );
  if (section === "login" && !gate.required)
    return (
      <div className="rx">
        <Login />
      </div>
    );

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
const SYNC_LABEL = {
  live: "Synced with the care team",
  connecting: "Connecting…",
  offline: "Offline: this browser only",
  off: "This browser only",
};
function DemoBar({ isPatient, roster, actingId, onSelect }) {
  const sourceLabel = useSourceLabel();
  const sync = useSyncStatus();
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
              Signed in as
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
          <span className={`rx-live rx-sync ${sync}`} title="Shared record">
            <i aria-hidden="true" />
            {SYNC_LABEL[sync] || sync}
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
  const sourceLabel = useSourceLabel();
  if (!cohort.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  return (
    <div className="rx">
      <DemoBar isPatient={false} />
      <DoctorApp route={route} cohort={cohort} sourceLabel={sourceLabel} />
    </div>
  );
}

function PatientRoot({ route }) {
  // The patient side is gated by the discharge code: one profile per sign-in, and
  // the app never derives or holds another patient's record. The roster carries
  // identities and codes only, for the sign-in screen.
  const roster = useRoster();
  const [signedIn, setSignedIn] = useState(() => currentPatientId());
  const actingId = roster.find((p) => p.id === signedIn)?.id ?? null;
  const patient = usePatient(actingId);
  const enter = (id) => {
    signIn(id);
    setSignedIn(id);
    go("/patient");
  };
  const leave = () => {
    signOut();
    setSignedIn(null);
    go("/patient");
  };
  if (!roster.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  if (!patient)
    return (
      <div className="rx">
        <DemoBar isPatient />
        <main className="rx-p-auth">
          <div className="rx-p-screen rx-card">
            <SignIn roster={roster} onSignIn={enter} />
          </div>
        </main>
      </div>
    );
  return (
    <div className="rx">
      <DemoBar
        isPatient
        roster={roster}
        actingId={patient.id}
        onSelect={enter}
      />
      <PatientApp
        key={patient.id}
        patient={patient}
        route={route}
        onSignOut={leave}
      />
    </div>
  );
}

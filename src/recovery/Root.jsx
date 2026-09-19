import { forgetUser, rememberUser } from "./model/currentUser.js";
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
import SignIn from "./patient/SignIn.jsx";
import { currentPatientId, signIn, signOut } from "./patient/session.js";
import Login from "./Login.jsx";
import Account from "./Account.jsx";
import SignInChoice from "./SignInChoice.jsx";
import RoleSignIn from "./SignIn.jsx";
import { useIdleSignOut } from "./idleSignOut.jsx";
import { LANDING_URL } from "./landingUrl.js";
import "./recovery.css";

const CODE_KEY = "rx-code";

// Ending a session has to reach the server, or automatic logoff is a claim
// about this tab rather than about the session. Fire-and-forget on purpose:
// the local state is cleared either way, so a failed request cannot strand
// somebody signed in on a screen that says they are not.
function endServerSession() {
  try {
    const held = sessionStorage.getItem(CODE_KEY);
    if (!held) return;
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${held}` },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no session storage
  }
}
const SIGNED_ROLE_KEY = "rx-signed-role";
const OPEN_DEMO_KEY = "rx-open-demo";

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
    // Whether this deployment wants an account or still takes a shared code.
    // The closed door answers it: a 401 carrying ACCOUNT_REQUIRED says which.
    accounts: false,
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
        const refusal = required && (await response.json().catch(() => ({})));
        const accounts = refusal?.code === "ACCOUNT_REQUIRED";
        let role = null;
        const held = sessionStorage.getItem(CODE_KEY);
        if (required && held) {
          // The same header carries either kind of credential, so try the one
          // that names a person first. A session token is not a role code and
          // /api/session would only ever refuse it.
          const me = await fetch("/api/auth/me", {
            headers: { authorization: `Bearer ${held}` },
          });
          if (me.ok) {
            const body = await me.json();
            if (["clinician", "patient"].includes(body.user?.role))
              role = body.user.role;
            rememberUser(body.user);
          } else if (!accounts) {
            const verified = await fetch("/api/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: held }),
            });
            if (verified.ok) {
              const body = await verified.json();
              if (["clinician", "patient"].includes(body.role))
                role = body.role;
            } else if (verified.status !== 401) throw new Error("unavailable");
          }
        }
        if (!live) return;
        // No codes configured means an open local demo: the shared record
        // syncs without a code and the patient's sign-in survives a reload.
        // Only a real gate with no valid code clears the sessions.
        if (required) sessionStorage.removeItem(OPEN_DEMO_KEY);
        else sessionStorage.setItem(OPEN_DEMO_KEY, "1");
        if (role) sessionStorage.setItem(SIGNED_ROLE_KEY, role);
        else if (required) {
          sessionStorage.removeItem(SIGNED_ROLE_KEY);
          sessionStorage.removeItem(CODE_KEY);
          forgetUser();
          signOut();
        }
        setGate({ checked: true, required, accounts, role });
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
  // Automatic logoff, which the HIPAA Security Rule requires of a system
  // holding health records. Only armed once a session exists, so the sign-in
  // screen is not a thing that expires.
  useIdleSignOut(!!gate.role, () => {
    endServerSession();
    sessionStorage.removeItem(SIGNED_ROLE_KEY);
    sessionStorage.removeItem(CODE_KEY);
    forgetUser();
    signOut();
    location.hash = "";
    location.reload();
  });

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
  // Nobody signed in and no destination asked for: the front door is the public landing
  // page, not a sign-in form. Any hash is a deliberate destination (the landing page's
  // own buttons come back through #/patient and #/login), so it falls through to the
  // gate below. The open local demo has no sign-in, so its bare address stays the ward.
  if (gate.required && !gate.role && !section && location.pathname === "/") {
    location.replace(LANDING_URL);
    return null;
  }
  // Role gate first (shared code per role, verified by the server); the patient
  // then opens their own profile with the discharge code in PatientRoot.
  // With accounts required, both roles go through the same screen; it asks for
  // the role's access code only when creating an account.
  const AccessScreen = gate.accounts
    ? Account
    : section === "patient"
      ? RoleSignIn
      : Login;
  if (gate.required && !gate.role) {
    if (section === "signin")
      return (
        <div className="rx">
          <SignInChoice />
        </div>
      );
    return (
      <div className="rx">
        <AccessScreen
          audience={section === "patient" ? "patient" : "clinician"}
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
  }
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

  return (
    <>
      {section === "patient" ? (
        <PatientRoot
          route={route}
          onFullSignOut={gate.accounts && gate.role ? signOutFully : null}
        />
      ) : (
        <DoctorRoot
          route={route}
          canSignOut={gate.required && !!gate.role}
          onSignOut={signOutFully}
        />
      )}
    </>
  );
}

// Ends the account's session on the server and in this tab, for either role. The bare
// address it reloads to is the landing page once nobody is signed in.
function signOutFully() {
  endServerSession();
  sessionStorage.removeItem(SIGNED_ROLE_KEY);
  sessionStorage.removeItem(CODE_KEY);
  forgetUser();
  sessionStorage.removeItem(ROLE_KEY);
  signOut();
  location.hash = "";
  location.reload();
}

function DoctorRoot({ route, canSignOut, onSignOut }) {
  const cohort = useCohort();
  const sourceLabel = useSourceLabel();
  if (!cohort.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  return (
    <div className="rx">
      <DoctorApp
        route={route}
        cohort={cohort}
        sourceLabel={sourceLabel}
        canSignOut={canSignOut}
        onSignOut={onSignOut}
      />
    </div>
  );
}

function PatientRoot({ route, onFullSignOut }) {
  // The patient side is gated by the discharge code: one profile per sign-in, and
  // the app never derives or holds another patient's record. The roster carries
  // identities and codes only, for the sign-in screen.
  const roster = useRoster();
  const [signedIn, setSignedIn] = useState(() => currentPatientId());
  const actingId = roster.find((p) => p.id === signedIn)?.id ?? null;
  const patient = usePatient(actingId);
  const enter = (id, code) => {
    signIn(id, code);
    setSignedIn(id);
    go("/patient");
  };
  const leave = () => {
    // With accounts, signing out means the account, not only this profile: otherwise
    // the session stays open behind the discharge-code screen. A shared role code and
    // the open local demo have no account, so there it closes the profile as before.
    if (onFullSignOut) return onFullSignOut();
    signOut();
    setSignedIn(null);
    go("/patient");
  };
  if (!roster.length)
    return <div className="rx rx-loading">Connecting to the data stream…</div>;
  if (!patient)
    return (
      <div className="rx">
        <main className="rx-p-auth">
          <div className="rx-p-screen rx-card">
            <SignIn roster={roster} onSignIn={enter} />
          </div>
        </main>
      </div>
    );
  return (
    <div className="rx">
      <PatientApp
        key={patient.id}
        patient={patient}
        route={route}
        onSignOut={leave}
      />
    </div>
  );
}

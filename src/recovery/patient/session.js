// The patient's sign-in for this browser: the discharge code opens one profile.
// Demo scaffolding: a real deployment would issue codes from the hospital system
// and bind them to an account. Session only, never persisted beyond the tab.
import { clearLog } from "../model/persist.js";

const KEY = "rx-patient-session";
// The discharge code that opened this profile, kept so the server can be shown
// it on every request. Without this the server sees only the shared patient
// role code, which names a role and not a person, and so has nothing to check
// a requested patientId against.
const CODE_KEY = "rx-patient-proof";

export const currentPatientId = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const signIn = (id, code) => {
  sessionStorage.setItem(KEY, id);
  if (code) sessionStorage.setItem(CODE_KEY, code);
};
// Set by Root.jsx when the server asks for no access codes.
const OPEN_DEMO_KEY = "rx-open-demo";
export const signOut = () => {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(CODE_KEY);
  // Behind access codes a sign-out is a different person's turn at this browser, so
  // what the last patient entered must not be replayed for them; the server holds the
  // shared record. The open local demo has no such boundary and relies on the log to
  // survive a reload, so it keeps it.
  if (!sessionStorage.getItem(OPEN_DEMO_KEY)) clearLog();
};
export const currentProof = () => {
  try {
    return sessionStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
};
export const normalizeCode = (s) => s.trim().toUpperCase().replace(/\s+/g, "");

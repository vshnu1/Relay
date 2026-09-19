// The patient's sign-in for this browser: the discharge code opens one profile.
// Demo scaffolding: a real deployment would issue codes from the hospital system
// and bind them to an account. Session only, never persisted beyond the tab.
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
export const signOut = () => {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(CODE_KEY);
};
export const currentProof = () => {
  try {
    return sessionStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
};
export const normalizeCode = (s) => s.trim().toUpperCase().replace(/\s+/g, "");

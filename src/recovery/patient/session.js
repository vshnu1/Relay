// The patient's sign-in for this browser: the discharge code opens one profile.
// Demo scaffolding: a real deployment would issue codes from the hospital system
// and bind them to an account. Session only, never persisted beyond the tab.
const KEY = "rx-patient-session";

export const currentPatientId = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const signIn = (id) => sessionStorage.setItem(KEY, id);
export const signOut = () => sessionStorage.removeItem(KEY);
export const normalizeCode = (s) => s.trim().toUpperCase().replace(/\s+/g, "");

// Who is signed in, as the server described them: { id, email, role, name, patientId }.
// Kept for display only (whose name goes on a message, which messages are yours).
// It is never trusted for access: the server stamps the sender of every message from
// the session and ignores what the browser claims.
const KEY = "rx-user";

export function rememberUser(user) {
  try {
    if (user) sessionStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // no session storage: names fall back to the record's
  }
}
export function forgetUser() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
}
export function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

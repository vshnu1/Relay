// What the patient enters survives a reload: imports, own readings, journal, device
// connections, check-ins and sent reports are kept as an event log in this browser
// and replayed onto the next snapshot. Nothing here leaves the device.
const KEY = "rx-patient-log";
const MAX_EVENTS = 400;

function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readLog() {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    const log = raw ? JSON.parse(raw) : [];
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}

export function appendLog(event) {
  const s = storage();
  if (!s) return;
  try {
    const log = readLog();
    log.push({ ...event, at: event.at ?? Date.now() });
    s.setItem(KEY, JSON.stringify(log.slice(-MAX_EVENTS)));
  } catch {
    // Quota or private mode: the app keeps working for this session.
  }
}

export function clearLog() {
  storage()?.removeItem(KEY);
}

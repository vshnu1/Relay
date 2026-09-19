// The shared recovery log. Everything either view enters (a check-in, a report, a
// journal entry, the model's result; a message, discharge notes, an appointment,
// a check-in request) is one event. The store applies it locally at once, then
// this module sends it to the API and polls for everyone else's, so a patient on
// their phone and a clinician on the ward laptop see the same record within a few
// seconds. Events carry a client id (`eid`), so a retried post is idempotent and an
// event coming back from the server is never applied twice.
//
// Without a server (a static build, or the API down) the store still works from
// this browser's own log; `status` says which. Nothing here interprets events.

const POLL_MS = 3000;
const BATCH = 50;

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function authHeaders() {
  const headers = { "content-type": "application/json" };
  try {
    const code = sessionStorage.getItem("rx-code");
    if (code) headers.authorization = `Bearer ${code}`;
    // Proof of which record this browser is entitled to. The role code alone
    // cannot say, so without this the server can only take the client's word
    // for the patientId it asks about.
    const proof = sessionStorage.getItem("rx-patient-proof");
    if (proof) headers["x-relay-discharge"] = proof;
  } catch {
    // no session storage
  }
  return headers;
}

// The signed-in patient, if any. The server filters the patient role to one
// record, so the poll has to say whose.
function currentScope() {
  try {
    // Only a patient has a patient scope. A clinician signing in on a browser
    // that had held a patient session would otherwise keep polling for that one
    // record, with a discharge proof that is no longer theirs, and collect a 403
    // every three seconds while the shared record quietly stopped syncing.
    if (sessionStorage.getItem("rx-signed-role") === "clinician") return null;
    return sessionStorage.getItem("rx-patient-session") || null;
  } catch {
    return null;
  }
}

export function createSync({
  fetchFn = typeof fetch === "function" ? fetch.bind(globalThis) : null,
  intervalMs = POLL_MS,
  scope = currentScope,
  path = "/api/recovery/events",
} = {}) {
  let seq = 0;
  let scopeSeen = undefined;
  let queue = [];
  let flushing = false;
  let timer = null;
  let onEvents = null;
  let onStatus = null;
  // Starts unknown, so the first verdict ("off", "live" or "offline") always
  // reaches the store instead of matching a placeholder and going unreported.
  let status = null;
  const setStatus = (next) => {
    if (next === status) return;
    status = next;
    onStatus?.(status);
  };

  async function flush() {
    if (flushing || !queue.length || !fetchFn) return;
    flushing = true;
    try {
      while (queue.length) {
        const batch = queue.slice(0, BATCH);
        const res = await fetchFn(path, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ events: batch.map((item) => item.event) }),
        });
        if (!res.ok) throw new Error(`push ${res.status}`);
        queue = queue.slice(batch.length);
        batch.forEach((item) => item.resolve({ delivered: true }));
        setStatus("live");
      }
    } catch {
      setStatus("offline"); // kept in the queue; the next tick retries
    } finally {
      flushing = false;
    }
  }

  async function poll() {
    if (!fetchFn) return;
    const who = scope();
    if (who !== scopeSeen) {
      // A different patient signed in on this browser: read their record from
      // the start. Duplicates are filtered by eid in the store.
      scopeSeen = who;
      seq = 0;
    }
    try {
      const url = `${path}?after=${seq}${who ? `&patientId=${encodeURIComponent(who)}` : ""}`;
      const res = await fetchFn(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`poll ${res.status}`);
      const body = await res.json();
      const events = Array.isArray(body.events) ? body.events : [];
      if (events.length) onEvents?.(events);
      if (typeof body.seq === "number") seq = Math.max(seq, body.seq);
      setStatus("live");
    } catch {
      setStatus("offline");
    }
  }

  // Nothing to send or collect until somebody has signed in. Without this the
  // sign-in screen polls every three seconds and takes a 401 each time: a
  // growing wall of red in the console before anyone has touched anything, and
  // a request every three seconds per open tab for no result. A runtime with no
  // sessionStorage at all (Node, the tests) is not a signed-out browser, so it
  // carries on as before.
  function signedOut() {
    try {
      if (typeof sessionStorage === "undefined") return false;
      // An open local demo (no codes configured, flagged by Root) has nothing
      // to wait for; a gated deployment waits until a code is held.
      return (
        !sessionStorage.getItem("rx-code") &&
        !sessionStorage.getItem("rx-open-demo")
      );
    } catch {
      return false;
    }
  }

  async function tick() {
    if (signedOut()) {
      setStatus("off");
      return;
    }
    await flush();
    await poll();
  }

  return {
    get status() {
      return status;
    },
    push(event) {
      if (!fetchFn) return Promise.resolve({ delivered: false });
      const delivery = new Promise((resolve) => {
        queue.push({ event, resolve });
      });
      flush();
      return delivery;
    },
    start(handlers) {
      onEvents = handlers.events;
      onStatus = handlers.status;
      if (!fetchFn) return () => {};
      tick();
      timer = setInterval(tick, intervalMs);
      return () => this.stop();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    // Test seam: run one cycle now.
    tick,
  };
}

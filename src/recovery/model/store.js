// One external store for both views, so an answer given in the patient view shows up
// in the doctor view at once. It holds raw facts only; derive.js computes the rest.
import { SIGNALS } from "./profiles.js";

const MAX_PER_SIGNAL = 96;
const RECENT_MS = 12 * 3600000;

export function createStore(source) {
  let state = {
    patients: {},
    order: [],
    now: Date.now(),
    sourceLabel: source.label,
    capabilities: source.capabilities,
  };
  const listeners = new Set();
  let queued = false;
  // A stream can deliver hundreds of events per second; coalesce them into one render.
  function change(fn) {
    state = fn(state);
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      listeners.forEach((l) => l());
    });
  }
  const patch = (id, fn) =>
    change((s) =>
      s.patients[id]
        ? {
            ...s,
            now: Date.now(),
            patients: { ...s.patients, [id]: fn(s.patients[id]) },
          }
        : s,
    );

  const disconnect = source.connect({
    snapshot: (list) =>
      change((s) => ({
        ...s,
        now: Date.now(),
        order: list.map((p) => p.id),
        patients: Object.fromEntries(list.map((p) => [p.id, p])),
      })),
    readings: (batch) =>
      change((s) => {
        const patients = { ...s.patients };
        for (const r of batch) {
          const p = patients[r.patientId];
          // Sharing is the patient's switch: readings from a paused device are dropped here,
          // whatever the source does.
          if (!p || !p.devices[SIGNALS[r.signal]?.device]?.sharing) continue;
          const list = (p.readings[r.signal] || []).concat({ t: r.t, v: r.v });
          // Keep history, thin out today's live readings so a long session stays small.
          if (list.length > MAX_PER_SIGNAL) {
            const i = list.findIndex((x) => x.t > r.t - RECENT_MS);
            if (i >= 0 && i < list.length - 1) list.splice(i, 1);
          }
          patients[r.patientId] = {
            ...p,
            readings: { ...p.readings, [r.signal]: list },
          };
        }
        return { ...s, now: Date.now(), patients };
      }),
    device: (id, deviceId, change_) =>
      patch(id, (p) =>
        p.devices[deviceId]?.sharing
          ? {
              ...p,
              devices: {
                ...p.devices,
                [deviceId]: { ...p.devices[deviceId], ...change_ },
              },
            }
          : p,
      ),
  });

  const send = (event) => source.send?.(event);
  const actions = {
    submitCheckin(id, answers) {
      patch(id, (p) => {
        const open = p.checkins.findIndex((c) => !c.answeredAt);
        const done = {
          requestedAt: Date.now(),
          ...(p.checkins[open] || {}),
          answeredAt: Date.now(),
          answers,
          note: null,
        };
        return {
          ...p,
          acknowledgedAt: null,
          checkins:
            open >= 0
              ? p.checkins.map((c, i) => (i === open ? done : c))
              : [...p.checkins, done],
        };
      });
      send({ type: "checkin", patientId: id, answers });
    },
    sendNote(id, note) {
      patch(id, (p) => ({
        ...p,
        checkins: p.checkins.map((c, i) =>
          i === p.checkins.length - 1 ? { ...c, note } : c,
        ),
      }));
      send({ type: "note", patientId: id, note });
    },
    requestCheckin(id) {
      patch(id, (p) =>
        p.checkins.some((c) => !c.answeredAt)
          ? p
          : {
              ...p,
              acknowledgedAt: null,
              checkins: [
                ...p.checkins,
                {
                  requestedAt: Date.now(),
                  answeredAt: null,
                  answers: {},
                  note: null,
                },
              ],
            },
      );
      send({ type: "request-checkin", patientId: id });
    },
    acknowledge(id) {
      patch(id, (p) => ({ ...p, acknowledgedAt: Date.now() }));
      send({ type: "acknowledge", patientId: id });
    },
    setSharing(id, deviceId, sharing) {
      patch(id, (p) => ({
        ...p,
        devices: {
          ...p.devices,
          [deviceId]: { ...p.devices[deviceId], sharing },
        },
      }));
      send({ type: "sharing", patientId: id, deviceId, sharing });
    },
    pauseAll(id) {
      patch(id, (p) => ({
        ...p,
        devices: Object.fromEntries(
          Object.entries(p.devices).map(([k, d]) => [
            k,
            { ...d, sharing: false },
          ]),
        ),
      }));
      send({ type: "sharing", patientId: id, deviceId: "*", sharing: false });
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
    destroy: disconnect,
  };
}

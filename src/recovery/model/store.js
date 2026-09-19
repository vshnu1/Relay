// One external store for both views, so an answer given in the patient view shows up
// in the doctor view at once. It holds raw facts only; derive.js computes the rest.
import { SIGNALS } from "./profiles.js";
import { appendLog, readLog } from "./persist.js";

const MAX_PER_SIGNAL = 96;
const MAX_IMPORTED = 120; // days kept per signal from a Health import
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

  const merge = (list, extra) => {
    const byT = new Map((list || []).map((r) => [r.t, r]));
    for (const r of extra) byT.set(r.t, { t: r.t, v: r.v });
    return [...byT.values()].sort((a, b) => a.t - b.t);
  };
  const apply = {
    import: (e) =>
      patch(e.patientId, (p) => {
        // `replace` drops the example readings so charts, baselines and the model
        // run on the patient's own data only; the simulated stream stops for them.
        const readings = e.replace ? {} : { ...p.readings };
        for (const [signal, list] of Object.entries(e.readings || {})) {
          if (!SIGNALS[signal]) continue;
          readings[signal] = merge(readings[signal], list.slice(-MAX_IMPORTED));
        }
        return {
          ...p,
          ownData: e.replace ? true : p.ownData,
          readings,
          devices: {
            ...p.devices,
            phone: {
              ...(p.devices.phone || {
                name: "iPhone Health app",
                sharing: true,
              }),
              connected: true,
              lastSync: e.at ?? Date.now(),
              imports: ((p.devices.phone || {}).imports || 0) + 1,
            },
          },
        };
      }),
    manual: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        readings: {
          ...p.readings,
          [e.signal]: merge(p.readings[e.signal], [{ t: e.t, v: e.v }]),
        },
        devices: {
          ...p.devices,
          manual: {
            ...(p.devices.manual || {
              name: "Your own entries",
              sharing: true,
            }),
            lastSync: e.t,
          },
        },
      })),
    journal: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        journal: [
          ...(p.journal || []),
          { t: e.t, kind: e.kind, text: e.text },
        ].sort((a, b) => a.t - b.t),
      })),
    connect: (e) =>
      patch(e.patientId, (p) =>
        p.devices[e.deviceId]
          ? {
              ...p,
              devices: {
                ...p.devices,
                [e.deviceId]: {
                  ...p.devices[e.deviceId],
                  connected: e.connected,
                  sharing: e.connected ? true : p.devices[e.deviceId].sharing,
                  lastSync: e.connected
                    ? (e.at ?? Date.now())
                    : p.devices[e.deviceId].lastSync,
                },
              },
            }
          : p,
      ),
    report: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        reports: [
          ...(p.reports || []),
          {
            sentAt: e.at ?? Date.now(),
            to: e.to,
            subject: e.subject,
            method: e.method,
          },
        ],
      })),
    checkin: (e) => answerCheckin(e.patientId, e.answers, e.at, e),
    note: (e) => attachNote(e.patientId, e.note),
    read: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        messages: (p.messages || []).map((m) =>
          m.t === e.t ? { ...m, readAt: e.at ?? Date.now() } : m,
        ),
      })),
    // Entered by the care team during the demo, so nothing on the patient's
    // screen is pre-written: discharge notes and medicines, messages either way,
    // and appointments.
    discharge: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        notes: e.notes ?? p.notes,
        medications: e.medications ?? p.medications,
      })),
    message: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        messages: [
          ...(p.messages || []),
          { t: e.t, from: e.from, by: e.by, text: e.text, readAt: null },
        ].sort((a, b) => a.t - b.t),
      })),
    appointment: (e) =>
      patch(e.patientId, (p) => ({
        ...p,
        appointments: [
          ...(p.appointments || []),
          { t: e.t, with: e.with, where: e.where },
        ].sort((a, b) => a.t - b.t),
      })),
  };
  const replayable = apply;
  const logged = (type, event) => {
    apply[type](event);
    appendLog({ type, ...event });
  };

  function answerCheckin(id, answers, at = Date.now(), details = {}) {
    patch(id, (p) => {
      const open = p.checkins.findIndex((c) => !c.answeredAt);
      const done = {
        requestedAt: at,
        ...(p.checkins[open] || {}),
        answeredAt: at,
        answers,
        note: null,
        ...(details.triggerKey ? { triggerKey: details.triggerKey } : {}),
        ...(details.kind ? { kind: details.kind } : {}),
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
  }
  function attachNote(id, note) {
    patch(id, (p) => ({
      ...p,
      checkins: p.checkins.map((c, i) =>
        i === p.checkins.length - 1 ? { ...c, note } : c,
      ),
    }));
  }

  const disconnect = source.connect({
    snapshot: (list) => {
      change((s) => ({
        ...s,
        now: Date.now(),
        order: list.map((p) => p.id),
        patients: Object.fromEntries(list.map((p) => [p.id, p])),
      }));
      // Replay what the patient entered before the reload, in order, without logging again.
      for (const e of readLog()) {
        const fn = replayable[e.type];
        if (fn) fn(e);
      }
    },
    readings: (batch) =>
      change((s) => {
        const patients = { ...s.patients };
        for (const r of batch) {
          const p = patients[r.patientId];
          // Sharing is the patient's switch: readings from a paused device are dropped here,
          // whatever the source does. A patient on their own imported data takes nothing
          // from the simulated stream.
          if (!p || p.ownData || !p.devices[SIGNALS[r.signal]?.device]?.sharing)
            continue;
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
    // Patient-entered facts, logged so they survive a reload.
    importReadings(id, readings, summary, { replace = false } = {}) {
      logged("import", {
        patientId: id,
        readings,
        summary,
        replace,
        at: Date.now(),
      });
      send({ type: "import", patientId: id, summary, replace });
    },
    addManualReading(id, signal, v, t = Date.now()) {
      logged("manual", { patientId: id, signal, v, t });
      send({ type: "reading", patientId: id, signal, v, t });
    },
    addJournal(id, kind, text, t = Date.now()) {
      logged("journal", { patientId: id, kind, text, t });
      send({ type: "journal", patientId: id, kind, text, t });
    },
    connectDevice(id, deviceId, connected) {
      logged("connect", { patientId: id, deviceId, connected, at: Date.now() });
      send({ type: "connect", patientId: id, deviceId, connected });
    },
    recordReport(id, { to, subject, method }) {
      logged("report", { patientId: id, to, subject, method, at: Date.now() });
      send({ type: "report", patientId: id, to, subject, method });
    },
    markRead(id, t) {
      logged("read", { patientId: id, t, at: Date.now() });
    },
    setAnalysis(id, analysis) {
      patch(id, (p) => ({ ...p, analysis }));
    },
    setDischarge(id, { notes, medications }) {
      logged("discharge", {
        patientId: id,
        notes,
        medications,
        at: Date.now(),
      });
      send({ type: "discharge", patientId: id, notes, medications });
    },
    // `by` is "clinician" or "patient"; `from` is the display name.
    sendMessage(id, { by, from, text }, t = Date.now()) {
      logged("message", { patientId: id, by, from, text, t });
      send({ type: "message", patientId: id, by, from, text, t });
    },
    bookAppointment(id, { t, with: who, where }) {
      logged("appointment", {
        patientId: id,
        t,
        with: who,
        where,
        at: Date.now(),
      });
      send({ type: "appointment", patientId: id, t, with: who, where });
    },
    submitCheckin(id, answers, details = {}) {
      logged("checkin", { patientId: id, answers, ...details, at: Date.now() });
      send({ type: "checkin", patientId: id, answers, ...details });
    },
    sendNote(id, note) {
      logged("note", { patientId: id, note, at: Date.now() });
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

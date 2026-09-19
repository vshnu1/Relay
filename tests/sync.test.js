import test from "node:test";
import assert from "node:assert/strict";

// Two browsers, one record. A fake API with the same semantics as the server's
// /api/recovery/events (append-only, seq numbers, idempotent by eid) sits between a
// patient's store and a clinician's store. What one enters, the other reads.
const { createStore } = await import("../src/recovery/model/store.js");
const { createSimulatedSource } =
  await import("../src/recovery/model/simulatedSource.js");
const { createSync } = await import("../src/recovery/model/sync.js");
const { derive } = await import("../src/recovery/model/derive.js");

function fakeServer() {
  const log = [];
  const ids = new Set();
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url, "http://relay.test");
    if (init.method === "POST") {
      const { events } = JSON.parse(init.body);
      for (const e of events) {
        if (ids.has(e.eid)) continue;
        ids.add(e.eid);
        log.push({ ...e, seq: log.length + 1 });
      }
      return { ok: true, json: async () => ({ seq: log.length }) };
    }
    const after = Number(u.searchParams.get("after")) || 0;
    const who = u.searchParams.get("patientId");
    return {
      ok: true,
      json: async () => ({
        events: log.filter(
          (e) => e.seq > after && (!who || e.patientId === who),
        ),
        seq: log.length,
      }),
    };
  };
  return { log, fetchFn };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (...syncs) => {
  for (let i = 0; i < 3; i++) {
    for (const s of syncs) await s.tick();
    await flush();
  }
};

test("a check-in on the patient side reaches the clinician's store, and a message comes back", async () => {
  const server = fakeServer();
  const patientSync = createSync({
    fetchFn: server.fetchFn,
    intervalMs: 60000,
    scope: () => "maya",
  });
  const clinicSync = createSync({
    fetchFn: server.fetchFn,
    intervalMs: 60000,
    scope: () => null,
  });
  const patient = createStore(createSimulatedSource(), { sync: patientSync });
  const clinic = createStore(createSimulatedSource(), { sync: clinicSync });
  await flush();
  const before = derive(clinic.getState().patients.maya, Date.now());
  const answered = (s) =>
    s.getState().patients.maya.checkins.filter((c) => c.answeredAt).length;
  const n = answered(clinic);

  patient.actions.submitCheckin("maya", { breathing: "A lot", fever: "No" });
  patient.actions.recordReport("maya", {
    to: "ward@example.org",
    subject: "Recovery report",
    method: "in-app",
    body: "Breathing harder for two days.",
    reason: "Readings and answers point the same way.",
  });
  patient.actions.addJournal("maya", "a symptom", "Dizzy after lunch.");
  await settle(patientSync, clinicSync);

  assert.equal(answered(clinic), n + 1, "the clinician sees the new check-in");
  const after = derive(clinic.getState().patients.maya, Date.now());
  assert.equal(after.answered.answers.breathing, "A lot");
  assert.equal(after.reports.at(-1).body, "Breathing harder for two days.");
  assert.equal(after.journal.at(-1).text, "Dizzy after lunch.");
  assert.notEqual(before.answered?.answeredAt, after.answered.answeredAt);

  clinic.actions.sendMessage("maya", {
    by: "clinician",
    from: "Dr. Ruiz",
    text: "Seen your report. Rest today.",
  });
  clinic.actions.requestCheckin("maya");
  await settle(clinicSync, patientSync);
  const mine = derive(patient.getState().patients.maya, Date.now());
  assert.equal(mine.messages.at(-1).text, "Seen your report. Rest today.");
  assert.ok(
    mine.pending,
    "the clinician's check-in request shows for the patient",
  );

  // Nothing lands twice: the patient's own events came back from the server too.
  assert.equal(answered(patient), n + 1);
  assert.equal(
    patient.getState().patients.maya.journal.length,
    clinic.getState().patients.maya.journal.length,
  );
  assert.equal(patient.getState().sync, "live");
  patient.destroy();
  clinic.destroy();
});

test("without a server the store stays this browser only and says so", async () => {
  const sync = createSync({
    fetchFn: async () => {
      throw new Error("down");
    },
    intervalMs: 60000,
    scope: () => null,
  });
  const store = createStore(createSimulatedSource(), { sync });
  await flush();
  await sync.tick();
  await flush();
  assert.equal(store.getState().sync, "offline");
  store.actions.addJournal("maya", "a symptom", "Still works locally.");
  assert.equal(
    store.getState().patients.maya.journal.at(-1).text,
    "Still works locally.",
  );
  store.destroy();
});

import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

// A tiny in-memory localStorage so the persistence log can be exercised in Node.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const { createStore } = await import("../src/recovery/model/store.js");
const { createSimulatedSource } =
  await import("../src/recovery/model/simulatedSource.js");
const { derive } = await import("../src/recovery/model/derive.js");
const { PROFILES, QUESTIONS, isScheduledDay, toModelContext } =
  await import("../src/recovery/model/profiles.js");
const { checkinDue, insight, notifications, buildReport } =
  await import("../src/recovery/model/schedule.js");
const { importHealthFile, createScanner } =
  await import("../src/recovery/model/healthImport.js");
const { readLog, clearLog } = await import("../src/recovery/model/persist.js");

const flush = () => new Promise((r) => setTimeout(r, 0));
async function cohort() {
  const store = createStore(createSimulatedSource());
  await flush();
  const view = (id) =>
    derive(store.getState().patients[id], store.getState().now);
  return { store, view };
}

test("every question maps onto a field the ML model scores", () => {
  for (const [id, q] of Object.entries(QUESTIONS)) {
    assert.ok(q.ml, `${id} has no ml field`);
    for (const option of q.options)
      assert.notEqual(q.toModel(option), undefined, `${id}/${option}`);
  }
  for (const [id, p] of Object.entries(PROFILES)) {
    assert.ok("ml" in p, `${id} does not say which ML program it maps to`);
    for (const q of p.questions)
      assert.ok(QUESTIONS[q], `${id} asks unknown question ${q}`);
  }
  const ctx = toModelContext("abdominalSurgery", {
    pain: "A lot",
    wound: "Yes",
    nausea: "No",
    breathing: "A little",
    fever: "Not sure",
    fatigue: "A lot",
    medicine: "No",
    activity: "No",
  });
  assert.deepEqual(ctx, {
    consent: true,
    pain_change: "Worse",
    wound_concern: true,
    nausea_vomiting: false,
    shortness_of_breath: true,
    fever_symptoms: null,
    fatigue: "Worsening",
    medication: "No changes",
    exercise: "No unusual activity",
  });
  const hf = toModelContext("heartFailure", {
    medicine: "Yes",
    swelling: "A lot",
  });
  assert.equal(hf.diuretic_adherence, "Missed or changed");
  assert.equal(hf.swelling, "Worsening");
});

test("check-ins are daily for the first week, then every other day", () => {
  assert.deepEqual([0, 1, 7, 8, 9, 10, 11, 29, 31].map(isScheduledDay), [
    true,
    true,
    true,
    false,
    true,
    false,
    true,
    true,
    false,
  ]);
});

test("due, insight and notifications follow the readings and the answers", async () => {
  const { store, view } = await cohort();
  const maya = view("maya");
  assert.equal(
    checkinDue(maya).reason,
    "answered",
    "answered today, so not due again",
  );
  const i = insight(maya);
  assert.equal(i.level, "send");
  assert.match(i.body, /harder breathing/);
  assert.equal(
    maya.messages.length,
    0,
    "nothing is pre-written for the patient",
  );
  store.actions.sendMessage("maya", {
    by: "clinician",
    from: "Nurse Amara",
    text: "Keep taking the antibiotics.",
  });
  store.actions.sendMessage("maya", {
    by: "patient",
    from: "Maya Okafor",
    text: "Will do.",
  });
  store.actions.bookAppointment("maya", {
    t: Date.now() + 86400000,
    with: "Dr. Ruiz",
    where: "Clinic",
  });
  store.actions.setDischarge("maya", {
    notes: "Finish the course.",
    medications: ["Amoxicillin"],
  });
  await flush();
  const after = view("maya");
  const ids = notifications(after).map((n) => n.id);
  assert.ok(ids.includes("report"));
  assert.equal(
    ids.filter((x) => x.startsWith("msg-")).length,
    1,
    "only the clinician's message notifies",
  );
  assert.ok(ids.some((x) => x.startsWith("appt-")));
  assert.equal(after.notes, "Finish the course.");
  assert.deepEqual(after.medications, ["Amoxicillin"]);
  const priya = view("priya");
  assert.deepEqual(checkinDue(priya), { due: true, reason: "asked" });
  const aisha = view("aisha");
  assert.equal(insight(aisha).level, "fine");
  const report = buildReport(after);
  assert.match(report.subject, /Maya Okafor, day 9/);
  assert.ok(
    report.body.includes(`${QUESTIONS.breathing.short}: A lot`),
    "check-in answers are in the report",
  );
  assert.equal(report.modelContext.shortness_of_breath, true);
  assert.match(report.body, /does not diagnose/);
  store.destroy();
});

function zipWith(name, text) {
  const data = Buffer.from(text, "utf8");
  const comp = deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0, 10);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  const cdOffset = 30 + nameBuf.length + comp.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nameBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, nameBuf, comp, central, nameBuf, eocd]);
}

const XML = `<?xml version="1.0"?>
<HealthData>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Fixture Watch" unit="count/min" value="60" startDate="2026-09-10 08:00:00 -0400" endDate="2026-09-10 08:00:00 -0400"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Fixture Watch" unit="count/min" value="64" startDate="2026-09-11 08:00:00 -0400" endDate="2026-09-11 08:00:00 -0400"/>
 <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Fixture Watch" unit="%" value="0.97" startDate="2026-09-11 02:00:00 -0400" endDate="2026-09-11 02:00:00 -0400"/>
 <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Fixture Watch" unit="%" value="0.95" startDate="2026-09-11 03:00:00 -0400" endDate="2026-09-11 03:00:00 -0400"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Fixture Watch" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-09-11 00:00:00 -0400" endDate="2026-09-11 03:00:00 -0400"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Fixture Watch" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-09-10 23:30:00 -0400" endDate="2026-09-11 07:00:00 -0400"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Fixture Watch" value="HKCategoryValueSleepAnalysisAsleepREM" startDate="2026-09-11 03:00:00 -0400" endDate="2026-09-11 04:30:00 -0400"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="lb" value="154.3" startDate="2026-09-11 07:00:00 -0400" endDate="2026-09-11 07:00:00 -0400"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Fixture Phone" unit="count" value="120" startDate="2026-09-11 07:00:00 -0400" endDate="2026-09-11 07:05:00 -0400"/>
</HealthData>`;

test("an Apple Health export.zip is read in the browser and reduced to one value per day", async () => {
  const zip = zipWith("apple_health_export/export.xml", XML);
  const file = new File([zip], "export.zip", { type: "application/zip" });
  const { readings, summary } = await importHealthFile(file);
  assert.deepEqual(
    readings.restingHr.map((r) => r.v),
    [60, 64],
  );
  assert.equal(readings.oxygen.length, 1);
  assert.equal(readings.oxygen[0].v, 96);
  assert.equal(
    readings.sleep[0].v,
    4.5,
    "asleep stages summed, in-bed ignored",
  );
  assert.ok(
    Math.abs(readings.weight[0].v - 70) < 0.05,
    "pounds converted to kilograms",
  );
  assert.equal(summary.recordsScanned, 9);
  assert.equal(summary.recordsUsed.restingHr, 2);
  assert.ok(!("steps" in readings));
  // plain export.xml works too
  const xml = new File([XML], "export.xml", { type: "text/xml" });
  assert.deepEqual(
    (await importHealthFile(xml)).readings.restingHr.map((r) => r.v),
    [60, 64],
  );
});

test("the scanner ignores lines that are not records or have no usable unit", () => {
  const s = createScanner();
  s.line(
    '<Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="bogus" value="60" startDate="2026-09-10 08:00:00 -0400"/>',
  );
  s.line('<Workout workoutActivityType="HKWorkoutActivityTypeRunning"/>');
  assert.deepEqual(s.result().readings, {});
});

test("what the patient enters survives a reload through the local log", async () => {
  clearLog();
  const a = await cohort();
  a.store.actions.addJournal(
    "priya",
    "symptom",
    "Felt dizzy after standing up.",
    1000,
  );
  a.store.actions.addManualReading("priya", "temperature", 37.9, 2000);
  a.store.actions.connectDevice("priya", "whoop", true);
  a.store.actions.importReadings(
    "priya",
    { restingHr: [{ t: 5000, v: 61 }] },
    { recordsScanned: 1 },
  );
  await flush();
  assert.equal(readLog().length, 4);
  a.store.destroy();
  const b = await cohort();
  const p = b.store.getState().patients.priya;
  assert.equal(p.journal[0].text, "Felt dizzy after standing up.");
  assert.equal(p.readings.temperature.at(-1).v, 37.9);
  assert.equal(p.devices.whoop.connected, true);
  assert.equal(p.devices.phone.connected, true);
  assert.equal(p.readings.restingHr[0].v, 61);
  const v = derive(p, b.store.getState().now);
  assert.ok(
    v.signals.some((s) => s.id === "temperature" && s.today === null),
    "manual entry from long ago is not today's reading",
  );
  b.store.destroy();
  clearLog();
});

test("readings become the model's event contract and the model's state leads the insight", async () => {
  const { toModelEvents, buildRequest } =
    await import("../src/recovery/model/mlClient.js");
  const events = toModelEvents({
    restingHr: [
      { t: 1000, v: 62 },
      { t: 1000, v: 63 },
      { t: 2000, v: 61 },
    ],
    oxygen: [
      { t: 3000, v: 96.5 },
      { t: 4000, v: 101 },
    ],
    skinTemp: [{ t: 5000, v: 33.9 }],
  });
  assert.deepEqual(
    events.map((e) => [e.metric, e.value, e.unit, e.source]),
    [
      ["rhr", 62, "bpm", "wearable"],
      ["rhr", 61, "bpm", "wearable"],
      ["spo2", 96.5, "%", "wearable"],
    ],
  );
  const { store, view } = await cohort();
  const req = buildRequest(view("maya"), {
    breathing: "A lot",
    medicine: "No",
    activity: "No",
  });
  assert.equal(req.program, "pneumonia_recovery");
  assert.equal(req.context.shortness_of_breath, true);
  assert.ok(req.events.length > 20);
  store.actions.setAnalysis("maya", {
    application_state: "review_recommended",
    anomaly_score: 0.83,
    is_anomalous: true,
    model_version: "baseline-iforest-v1",
    data_quality: { status: "sufficient" },
    contributors: [
      {
        metric: "respiratory",
        label: "Respiratory rate",
        direction: "above_baseline",
        robust_deviation: 3.1,
        persistence_windows: 5,
      },
    ],
    missing_signals: [],
  });
  await flush();
  const i = insight(view("maya"));
  assert.equal(i.level, "send");
  assert.match(i.body, /scored this pattern 83 out of 100/);
  assert.match(
    buildReport(view("maya")).body,
    /Relay model \(baseline-iforest-v1\): review_recommended/,
  );
  store.destroy();
});

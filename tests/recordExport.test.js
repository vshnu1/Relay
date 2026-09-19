import test from "node:test";
import assert from "node:assert/strict";

const { createSimulatedSource } =
  await import("../src/recovery/model/simulatedSource.js");
const { derive } = await import("../src/recovery/model/derive.js");
const { buildRecordExport, recordAsText, RECORD_FORMAT } =
  await import("../src/recovery/model/recordExport.js");

// One synthetic patient, derived the way the app derives them.
function maya() {
  let raw = null;
  const stop = createSimulatedSource().connect({
    snapshot: (list) => (raw = list.find((p) => p.id === "maya")),
    readings() {},
    device() {},
  });
  stop();
  return derive(
    {
      ...raw,
      messages: [
        { t: 1789840000000, by: "clinician", from: "Dr. Ruiz", text: "Rest." },
      ],
    },
    Date.now(),
  );
}

test("a patient's copy holds the whole record, not a summary", () => {
  const p = maya();
  const record = buildRecordExport(p, 1789850000000);
  assert.equal(record.format, RECORD_FORMAT);
  assert.equal(record.generatedAt, new Date(1789850000000).toISOString());
  assert.equal(record.patient.name, p.name);
  assert.equal(record.patient.hospital, p.hospital);
  assert.deepEqual(record.medications, p.medications);
  assert.equal(record.checkIns.length, p.checkins.length);
  assert.equal(record.messages[0].text, "Rest.");
  // Every reading, per signal, with a timestamp and where it came from.
  for (const [signal, list] of Object.entries(p.readings)) {
    assert.equal(record.readings[signal].values.length, list.length);
    assert.equal(record.readings[signal].source, "wearable");
  }
  const first = Object.values(record.readings).find((s) => s.values.length);
  assert.match(first.values[0].at, /^\d{4}-\d{2}-\d{2}T/);
});

test("the copy never carries the discharge code, which is a credential", () => {
  const p = maya();
  assert.ok(p.code, "the patient under test has a code to leak");
  const record = buildRecordExport(p);
  assert.ok(!JSON.stringify(record).includes(p.code));
  assert.ok(!recordAsText(record).includes(p.code));
});

test("the readable copy names every section and points at the full data", () => {
  const text = recordAsText(buildRecordExport(maya()));
  for (const heading of [
    "About you",
    "Discharge notes",
    "Medicines",
    "Appointments",
    "Check-ins",
    "Messages",
    "Readings from your devices",
  ])
    assert.ok(text.includes(heading), heading);
  assert.ok(text.includes("Dr. Ruiz: Rest."));
  assert.ok(text.includes(".json"));
});

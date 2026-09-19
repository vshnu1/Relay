import test from "node:test";
import assert from "node:assert/strict";
import { buildClinicianSummary } from "../src/recovery/doctor/clinicianSummary.js";

const patient = {
  id: "synthetic-1",
  name: "Demo Person",
  first: "Demo",
  profile: { after: "pneumonia" },
  dayHome: 9,
  windowDays: 30,
  status: "review",
  moved: [
    {
      plain: "Breathing while asleep",
      today: 16.5,
      unit: "per min",
      change: "+16%",
      towardDays: 3,
      fmt: (value) => value.toFixed(1),
    },
  ],
  counted: [{}, {}],
  answered: {
    answers: { breathing: "A little" },
    note: "Sensitive free text stays out of the audio summary.",
  },
};

test("clinician briefing states watch status, readings, and model evidence", () => {
  const text = buildClinicianSummary(
    patient,
    {
      application_state: "review_recommended",
      anomaly_score: 0.78,
      contributors: [{ label: "Breathing rate", direction: "above_baseline" }],
    },
    true,
  );
  assert.match(text, /clinician review is recommended/);
  assert.match(text, /16\.5 per minute, about 16 percent above usual/);
  assert.match(
    text,
    /The latest Relay model assessment is unusual pattern; clinician review is recommended/,
  );
  assert.match(
    text,
    /The strongest model signals were Breathing rate higher than this patient's usual/,
  );
  assert.match(
    text,
    /the patient reported a little worsening in breathing with usual activity/,
  );
  assert.doesNotMatch(text, /Demo Person|Sensitive free text|synthetic-1/);
});

test("without a score the briefing clearly identifies its readings-only fallback", () => {
  const text = buildClinicianSummary(
    { ...patient, moved: [], status: "monitoring" },
    null,
  );
  assert.match(text, /No clinician review is requested right now/);
  assert.match(
    text,
    /No watched reading is currently past its persistent threshold/,
  );
  assert.match(text, /A trained-model score is not included in this briefing/);
});

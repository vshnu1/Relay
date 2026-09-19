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
  assert.match(text, /review recommended/);
  assert.match(text, /16\.5 per min, \+16% from usual/);
  assert.match(
    text,
    /Fresh Vesper model result: unusual pattern; clinician review is recommended/,
  );
  assert.match(text, /Breathing rate higher than this patient's usual/);
  assert.match(text, /breathing: A little/);
  assert.doesNotMatch(text, /Demo Person|Sensitive free text|synthetic-1/);
});

test("without a score the briefing clearly identifies its readings-only fallback", () => {
  const text = buildClinicianSummary(
    { ...patient, moved: [], status: "monitoring" },
    null,
  );
  assert.match(text, /no review currently requested/);
  assert.match(
    text,
    /No counted wearable signal is currently past its persistent watch threshold/,
  );
  assert.match(text, /Vesper has not returned a score/);
});

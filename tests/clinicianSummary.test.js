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

test("clinician briefing stays concise and includes concerning readings and patient context", () => {
  const text = buildClinicianSummary(
    patient,
    {
      application_state: "review_recommended",
      anomaly_score: 0.78,
      contributors: [{ label: "Breathing rate", direction: "above_baseline" }],
    },
    true,
  );
  assert.match(text, /Review recommended/);
  assert.match(text, /16\.5 per minute/);
  assert.match(
    text,
    /patient reports breathing with usual activity is a little worse/,
  );
  assert.doesNotMatch(
    text,
    /trained-model score|model assessment|wearable readings/,
  );
  assert.doesNotMatch(text, /Demo Person|Sensitive free text|synthetic-1/);
});

test("a calm day gets a short general update without model implementation details", () => {
  const text = buildClinicianSummary(
    {
      ...patient,
      moved: [],
      status: "monitoring",
      answered: { answers: { breathing: "No" } },
    },
    null,
  );
  assert.match(text, /No concerning changes are flagged today/);
  assert.doesNotMatch(text, /trained-model score|readings-only fallback/);
});

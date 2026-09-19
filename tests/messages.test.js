import test from "node:test";
import assert from "node:assert/strict";
import { describeAnalysis } from "../src/recovery/model/mlClient.js";
import { PROFILES } from "../src/recovery/model/profiles.js";

const STATES = [
  "review_recommended",
  "context_needed",
  "insufficient_data",
  "monitoring",
];
const analysis = (application_state) => ({
  application_state,
  contributors: [
    { label: "Resting heart rate", direction: "above_baseline" },
    { label: "Sleep duration", direction: "below_baseline" },
  ],
  missing_signals: [{ metric: "resting_heart_rate" }],
});

test("the model's message names what the patient is recovering from", () => {
  for (const [key, profile] of Object.entries(PROFILES))
    for (const state of STATES) {
      const msg = describeAnalysis(analysis(state), profile);
      assert.ok(
        msg.includes(profile.after),
        `${key}/${state} must name the condition, got: ${msg}`,
      );
    }
});

test("every condition and state produces a distinct message", () => {
  const seen = new Map();
  for (const [key, profile] of Object.entries(PROFILES))
    for (const state of STATES) {
      const msg = describeAnalysis(analysis(state), profile);
      const clash = seen.get(msg);
      assert.equal(
        clash,
        undefined,
        `${key}/${state} reads identically to ${clash}. Two patients with different discharges must not get the same sentence.`,
      );
      seen.set(msg, `${key}/${state}`);
    }
  assert.equal(seen.size, Object.keys(PROFILES).length * STATES.length);
});

test("the message never names a condition as a finding, only as a recovery", () => {
  // The boundary: saying "recovering after pneumonia" is context the patient
  // already knows. Saying the readings mean pneumonia would be a diagnosis.
  for (const profile of Object.values(PROFILES))
    for (const state of STATES) {
      const msg = describeAnalysis(analysis(state), profile);
      assert.match(
        msg,
        /^Recovering after /,
        "the condition must appear as recovery context, never as a conclusion",
      );
      assert.doesNotMatch(msg, /\b(diagnos|likely|risk of|suggests that)\b/i);
    }
});

test("no profile still falls back cleanly", () => {
  const msg = describeAnalysis(analysis("context_needed"), null);
  assert.ok(msg.startsWith("Relay's model"), msg);
  assert.equal(describeAnalysis(null, null), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckinPlan } from "../src/recovery/patient/checkinPlan.js";
import { PROFILES } from "../src/recovery/model/profiles.js";

test("workflow contributors prioritize short discharge-specific check-in questions", () => {
  const patient = {
    profileId: "strokeRehabilitation",
    profile: PROFILES.strokeRehabilitation,
    questions: PROFILES.strokeRehabilitation.questions,
    counted: [],
  };
  const plan = buildCheckinPlan(patient, {
    application_state: "review_recommended",
    contributors: [
      { metric: "walking_speed", direction: "below_baseline" },
      { metric: "steps", direction: "below_baseline" },
    ],
  });
  assert.equal(plan.mode, "change");
  assert.equal(plan.priority, true);
  assert.ok(plan.questions.length <= 3);
  assert.ok(
    plan.questions.every((question) => patient.questions.includes(question)),
  );
  assert.ok(
    plan.questions.includes("dizziness") || plan.questions.includes("fatigue"),
  );
  assert.equal(plan.questions.at(-1), "mealPlan");
});

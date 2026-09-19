import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckinPlan } from "../src/recovery/patient/checkinPlan.js";
import {
  CHECKIN_QUESTIONS,
  PROFILES,
  QUESTIONS,
} from "../src/recovery/model/profiles.js";

test("a workflow result keeps the check-in short and on the discharge profile's questions", () => {
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
  assert.ok(plan.questions.includes("strokeFatigue"));
  assert.equal(plan.questions.at(-1), "mealPlan");
});

test("every watch profile has its own fixed check-in, worded for that recovery", () => {
  const seen = new Map();
  for (const [id, profile] of Object.entries(PROFILES)) {
    const asked = CHECKIN_QUESTIONS[id];
    assert.ok(asked?.length === 3, `${id} asks three questions`);
    for (const question of asked) {
      assert.ok(QUESTIONS[question], `${id}: ${question} is defined`);
      // The clinician views list answers by walking the profile's pool.
      assert.ok(
        profile.questions.includes(question),
        `${id}: ${question} is in the pool the clinician views read`,
      );
    }
    const plan = buildCheckinPlan({
      profileId: id,
      profile,
      questions: profile.questions,
      counted: [],
    });
    assert.deepEqual(plan.questions, asked);
    seen.set(id, asked.join());
  }
  // Tailored means different: no two profiles share a check-in, except atrial
  // fibrillation and cardiac recovery, which would if either lost its own wording.
  assert.equal(new Set(seen.values()).size, seen.size);
});

test("a model result cannot change which questions are asked", () => {
  const patient = {
    profileId: "pneumonia",
    profile: PROFILES.pneumonia,
    questions: PROFILES.pneumonia.questions,
    counted: [],
  };
  const before = buildCheckinPlan(patient).questions;
  const after = buildCheckinPlan(patient, {
    application_state: "monitoring",
    is_anomalous: false,
    contributors: [
      { metric: "sleep", direction: "below_baseline" },
      { metric: "hrv", direction: "below_baseline" },
    ],
  }).questions;
  assert.deepEqual(after, before);
  assert.deepEqual(after, CHECKIN_QUESTIONS.pneumonia);
});

test("a tailored question keeps the answer options and model field of the one it varies", () => {
  for (const [id, question] of Object.entries(QUESTIONS)) {
    if (!question.base) continue;
    const base = QUESTIONS[question.base];
    assert.ok(base, `${id} varies a question that exists`);
    assert.deepEqual(question.options, base.options);
    assert.equal(question.ml, base.ml);
    assert.notEqual(question.text, base.text);
  }
});

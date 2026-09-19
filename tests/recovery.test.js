import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/recovery/model/store.js";
import { createSimulatedSource } from "../src/recovery/model/simulatedSource.js";
import { derive } from "../src/recovery/model/derive.js";
import { buildCheckinPlan } from "../src/recovery/patient/checkinPlan.js";
import {
  adaptiveTurnGuidance,
  openingMessage,
} from "../src/recovery/patient/voice.js";
import { QUESTIONS } from "../src/recovery/model/profiles.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function cohort() {
  const store = createStore(createSimulatedSource());
  await flush();
  const views = () => {
    const s = store.getState();
    return Object.fromEntries(
      s.order.map((id) => [id, derive(s.patients[id], s.now)]),
    );
  };
  return { store, views };
}

test("statuses are derived from readings and check-ins, not stored", async () => {
  const { store, views } = await cohort();
  const v = views();
  assert.deepEqual(
    Object.fromEntries(Object.entries(v).map(([id, p]) => [id, p.status])),
    {
      maya: "review",
      daniel: "review",
      priya: "context",
      tom: "context",
      aisha: "monitoring",
      samuel: "monitoring",
      george: "monitoring",
      lena: "nodata",
      // Six further conditions, two patients each: one whose signals have
      // moved and one whose have not, so every profile is exercised in both
      // directions and the quiet cases outnumber the loud ones.
      marcus: "context",
      nadia: "monitoring",
      yusuf: "context",
      ingrid: "nodata",
      oliver: "context",
      beatrice: "monitoring",
      hassan: "context",
      clara: "monitoring",
      arthur: "context",
      mei: "monitoring",
      rosa: "context",
      amara: "monitoring",
      // Stroke rehabilitation and cardiac recovery: enabled once the gait
      // signals existed, so the same moved/quiet pair covers them too.
      nathan: "context",
      dorothy: "monitoring",
      felix: "context",
      ruth: "monitoring",
      // Hip/knee replacement and post-chemotherapy, one moved and one quiet each.
      elena: "context",
      raymond: "monitoring",
      grace: "context",
      victor: "monitoring",
    },
  );
  const summaryCounts = Object.groupBy(
    Object.values(v),
    (patient) => patient.group,
  );
  assert.deepEqual(
    {
      review: summaryCounts.review.length,
      context: summaryCounts.context.length,
      nodata: summaryCounts.nodata.length,
      monitoring: summaryCounts.monitoring.length,
    },
    { review: 2, context: 12, nodata: 2, monitoring: 12 },
  );
  assert.equal(
    Object.values(summaryCounts).reduce(
      (total, group) => total + group.length,
      0,
    ),
    Object.keys(v).length,
    "the four status totals account for every patient",
  );
  assert.equal(v.maya.moved.length, 4);
  // Discharge times are spread across the cohort so the watchlist does not
  // print one identical persistence figure down the whole column, so pin the
  // range rather than the hour, and require the sentence to quote whatever the
  // view actually computed.
  assert.ok(
    v.maya.hours >= 24 && v.maya.hours < 48,
    `hours was ${v.maya.hours}`,
  );
  assert.match(
    v.maya.line,
    new RegExp(
      `breathing rate, resting heart rate and skin temperature up, blood oxygen down, for ${v.maya.hours} hours`,
      "i",
    ),
  );
  assert.match(v.maya.line, /Reports harder breathing/);
  assert.match(
    v.aisha.line,
    /one-day rise in average heart rate after a recorded workout/,
  );
  store.destroy();
});

test("a patient's answers move them from waiting to review, and a note attaches to them", async () => {
  const { store, views } = await cohort();
  assert.equal(views().priya.status, "context");
  const initialReviewCount = Object.values(views()).filter(
    (patient) => patient.group === "review",
  ).length;
  store.actions.submitCheckin("priya", {
    pain: "A little",
    fever: "No",
    medicine: "No",
    activity: "No",
  });
  store.actions.sendNote("priya", "The wound feels warm.");
  await flush();
  const priya = views().priya;
  assert.equal(priya.status, "review");
  assert.equal(
    Object.values(views()).filter((patient) => patient.group === "review")
      .length,
    initialReviewCount + 1,
    "a completed check-in for a patient with a persistent pattern increments the live review count",
  );
  assert.equal(priya.answered.note, "The wound feels warm.");
  assert.match(priya.line, /Reports worse wound pain/);
  store.actions.acknowledge("priya");
  await flush();
  assert.equal(views().priya.group, "monitoring");
  assert.equal(
    Object.values(views()).filter((patient) => patient.group === "review")
      .length,
    initialReviewCount,
    "acknowledging the review removes it from the open review count",
  );
  store.actions.requestCheckin("priya");
  await flush();
  assert.equal(views().priya.status, "context");
  store.destroy();
});

test("check-in questions follow the signals that moved for the discharge program", async () => {
  const { store, views } = await cohort();
  const priya = views().priya;
  assert.deepEqual(
    priya.questions,
    ["fever", ...priya.profile.questions.filter((q) => q !== "fever")],
    "skin temperature movement puts the fever question first for abdominal recovery",
  );
  assert.match(priya.questionReason, /skin temperature/i);

  const aisha = views().aisha;
  assert.deepEqual(
    aisha.questions,
    aisha.profile.questions,
    "without a persistent change, the program's normal context order is kept",
  );
  store.destroy();
});

test("focused voice check-in orders model-linked symptoms before a plan question", async () => {
  const { store, views } = await cohort();
  const maya = views().maya;
  const analysis = {
    application_state: "context_needed",
    contributors: [
      {
        metric: "respiratory",
        label: "Respiratory rate",
        direction: "above_baseline",
      },
      {
        metric: "rhr",
        label: "Resting heart rate",
        direction: "above_baseline",
      },
      { metric: "sleep", label: "Sleep duration", direction: "below_baseline" },
    ],
  };
  const plan = buildCheckinPlan(maya, analysis);
  assert.deepEqual(plan.questions, ["breathing", "fatigue", "medicine"]);
  assert.equal(plan.priority, true);
  assert.match(plan.contextPrompt, /activity, meals, or drinks/i);

  const opening = openingMessage(
    maya,
    plan.questions,
    true,
    plan.mode,
    plan.findingSummary,
  );
  assert.match(opening, /higher than usual/);
  assert.match(opening, /Is your breathing harder/);
  assert.ok(opening.split(/\s+/).length <= 40, "the spoken opener stays short");
  assert.doesNotMatch(opening, /then one optional question/i);
  assert.doesNotMatch(opening, /no, a little, a lot/i);
  assert.doesNotMatch(opening, /are you comfortable continuing/i);

  const felix = views().felix;
  const cardiacPlan = buildCheckinPlan(felix, {
    application_state: "context_needed",
    contributors: [
      { metric: "steps", label: "Daily steps", direction: "below_baseline" },
      {
        metric: "rhr",
        label: "Resting heart rate",
        direction: "above_baseline",
      },
    ],
  });
  assert.deepEqual(
    cardiacPlan.questions,
    ["fatigue", "chest", "medicine"],
    "question order follows the model's contributor priority, not just profile order",
  );
  store.destroy();
});

test("voice check-in adapts one brief follow-up to the patient's answer", () => {
  const unchanged = adaptiveTurnGuidance("breathing", "No, about the same");
  assert.equal(unchanged.asksFollowUp, false);
  assert.match(unchanged.message, /do not probe/i);
  assert.match(unchanged.message, /next selected question/i);

  const changed = adaptiveTurnGuidance("breathing", "Yes, it is harder");
  assert.equal(changed.asksFollowUp, true);
  assert.match(changed.message, /when did you first notice/i);
  assert.match(changed.message, /do not infer a cause/i);

  const diet = adaptiveTurnGuidance("mealPlan", "Yes, I had pizza");
  assert.equal(diet.asksFollowUp, true);
  assert.match(diet.message, /what you ate or drank/i);
  assert.match(diet.message, /discharge instruction/i);

  const spent = adaptiveTurnGuidance("medicine", "I stopped it", true);
  assert.equal(spent.asksFollowUp, false);
  assert.match(spent.message, /do not ask another follow-up/i);
});

test("stroke check-in includes a discharge-specific eating and drinking question for model context", async () => {
  const { store, views } = await cohort();
  const strokePatient = Object.values(views()).find(
    (patient) => patient.profileId === "strokeRehabilitation",
  );
  assert.ok(
    strokePatient,
    "the demo cohort includes a stroke recovery patient",
  );
  const plan = buildCheckinPlan(strokePatient, {
    application_state: "context_needed",
    contributors: [
      {
        metric: "walking_speed",
        label: "Walking speed",
        direction: "below_baseline",
      },
      { metric: "steps", label: "Daily steps", direction: "below_baseline" },
    ],
  });
  assert.ok(plan.questions.includes("mealPlan"));
  assert.match(QUESTIONS["mealPlan"].text, /discharge instructions/i);
  assert.match(plan.contextPrompt, /rehabilitation routine/i);
  assert.equal(QUESTIONS["mealPlan"].ml, "diet_change");
  store.destroy();
});

// A hand-driven source: the same contract a hardware or server feed would implement.
function manualSource() {
  let roster;
  createSimulatedSource().connect({
    snapshot: (list) => (roster = list),
    readings() {},
    device() {},
  })();
  const source = {
    label: "Manual",
    capabilities: { voice: false },
    connect: (handlers) => (
      (source.push = handlers.readings),
      handlers.snapshot(roster),
      () => {}
    ),
  };
  return source;
}

test("readings from any source change the result, and a paused device is ignored", async () => {
  const source = manualSource();
  const store = createStore(source);
  await flush();
  const samuel = () =>
    derive(store.getState().patients.samuel, store.getState().now);
  assert.equal(samuel().status, "monitoring");
  const now = store.getState().now;
  // Readings that are far past the thresholds arrive for yesterday and today.
  const feed = ["restingHr", "hrv"].flatMap((signal) =>
    [now - 30 * 3600000, now - 1000].flatMap((t) =>
      Array(12).fill({
        patientId: "samuel",
        signal,
        t,
        v: signal === "hrv" ? 20 : 80,
      }),
    ),
  );

  store.actions.setSharing("samuel", "watch", false);
  source.push(feed);
  await flush();
  assert.equal(
    samuel().status,
    "monitoring",
    "readings from a paused device must be dropped",
  );

  store.actions.setSharing("samuel", "watch", true);
  source.push(feed);
  await flush();
  assert.equal(samuel().pattern, true);
  assert.equal(
    samuel().status,
    "context",
    "a new pattern with no check-in waits on the patient",
  );
  store.destroy();
});

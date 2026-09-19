import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/recovery/model/store.js";
import { createSimulatedSource } from "../src/recovery/model/simulatedSource.js";
import { derive } from "../src/recovery/model/derive.js";

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
      // Hip/knee replacement and post-chemotherapy, one moved and one quiet each.
      elena: "context",
      raymond: "monitoring",
      grace: "context",
      victor: "monitoring",
    },
  );
  assert.equal(v.maya.moved.length, 4);
  assert.equal(v.maya.hours, 38);
  assert.match(
    v.maya.line,
    /breathing rate, resting heart rate and skin temperature up, blood oxygen down, for 38 hours/i,
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
  assert.equal(priya.answered.note, "The wound feels warm.");
  assert.match(priya.line, /Reports worse wound pain/);
  store.actions.acknowledge("priya");
  await flush();
  assert.equal(views().priya.group, "monitoring");
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

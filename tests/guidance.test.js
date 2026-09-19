import test from "node:test";
import assert from "node:assert/strict";

// A tiny in-memory localStorage so the store can be built in Node.
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
const { PROFILES, SIGNALS } = await import("../src/recovery/model/profiles.js");
const { homeGuidance, metricGuidance, observation } =
  await import("../src/recovery/patient/guidance.js");

const HOUR = 3600000;
const NOW = Date.UTC(2026, 8, 19, 15, 0, 0);
const flush = () => new Promise((r) => setTimeout(r, 0));
async function cohort() {
  const store = createStore(createSimulatedSource());
  await flush();
  const state = store.getState();
  const view = (id) => derive(state.patients[id], state.now);
  return { store, view, now: state.now };
}

// Words the guidance must never use: it describes readings, it does not judge
// them, and it speaks only about measurements the record holds.
const FORBIDDEN =
  /diagnos|\bhigh\b|\blow\b|\bnormal\b|abnormal|will improve|will get better|guarantee|cholesterol|blood pressure|glucose|sugar|\blabs?\b|\bdiet\b/i;
const text = (g) => `${g.title} ${g.body} ${g.evidence}`;
const clean = (g, label) => {
  assert.ok(g, `${label}: guidance exists`);
  assert.doesNotMatch(text(g), FORBIDDEN, `${label}: ${text(g)}`);
  assert.ok(g.title && g.body && g.evidence, `${label}: all three lines`);
  assert.match(g.evidence, /^(Based on|Requested by)/, `${label}: evidence`);
};

// A derived-looking signal, built from the real definition so names, units and
// directions are the ones the patient sees.
function sig(id, over = {}) {
  const info = SIGNALS[id] || {
    name: id,
    short: id,
    plain: id,
    unit: "",
    digits: 0,
    device: "watch",
    dir: 1,
    up: "Higher",
    down: "Lower",
    span: "days",
  };
  const s = {
    id,
    ...info,
    counted: true,
    watchDir: info.dir,
    usual: null,
    today: null,
    todayLevel: null,
    towardDays: 0,
    runStart: null,
    moved: false,
    enoughBaseline: true,
    home: [],
    fmt: (v) => (v === null || v === undefined ? "–" : v.toFixed(info.digits)),
    ...over,
  };
  if (s.moved && s.runStart === null) s.runStart = 7;
  if (s.moved && !s.towardDays) s.towardDays = 2;
  // Ten days at home, every night recorded except a missing today.
  if (!over.home)
    s.home = Array.from({ length: 10 }, (_, day) => ({
      day,
      v: day === 9 ? s.today : s.usual,
    }));
  return s;
}
const usual = (id, value) =>
  sig(id, { usual: value, today: value, todayLevel: 0 });

function patient(signals, over = {}) {
  const counted = signals.filter((s) => s.counted);
  return {
    id: "t",
    first: "Test",
    profileId: "pneumonia",
    profile: PROFILES.pneumonia,
    dayHome: 9,
    devices: {
      watch: { name: "Apple Watch", connected: true },
      whoop: { name: "WHOOP", connected: true },
      phone: { name: "iPhone Health app", connected: true },
      manual: { name: "Your own entries", connected: true },
    },
    signals,
    counted,
    moved: counted.filter((s) => s.moved),
    pattern: false,
    hours: 0,
    status: "monitoring",
    pending: null,
    answered: null,
    checkins: [],
    analysis: null,
    ...over,
  };
}

test("the demo patient with four moved vitals is told to complete the check-in, with the numbers", async () => {
  const { store, view, now } = await cohort();
  const maya = view("maya");
  const g = homeGuidance(maya, now);
  clean(g, "maya home");
  assert.equal(g.id, "checkin");
  assert.equal(g.title, "Complete your check-in");
  assert.equal(g.cta.href, "#/patient/checkin");
  assert.match(
    g.body,
    /breathing while asleep has been faster than your usual since day 9/,
  );
  assert.match(
    g.body,
    /Three other readings have moved with it, for about \d+ hours/,
  );
  assert.match(g.body, /discharge letter/);
  assert.match(g.evidence, /Apple Watch and WHOOP/);
  assert.doesNotMatch(
    g.body,
    /walk|exercise/i,
    "vitals never lead to exercise",
  );
  // Under the charts: the vital repeats the step, sleep gets its own advice,
  // and the temperature she never entered gets nothing at all.
  const by = Object.fromEntries(maya.signals.map((s) => [s.id, s]));
  assert.equal(metricGuidance(by.breathing, maya, now).id, "checkin");
  const sleep = metricGuidance(by.sleep, maya, now);
  clean(sleep, "maya sleep");
  assert.equal(sleep.id, "sleep");
  assert.match(
    sleep.body,
    /sleep has been shorter than your usual since day 9 \(5\.9 against 7\.2 hours\)/,
  );
  assert.match(sleep.body, /bedtime/);
  assert.match(sleep.body, /caffeine/);
  assert.equal(metricGuidance(by.temperature, maya, now), null);
  store.destroy();
});

test("the quiet demo patient is told to keep to the plan, and her empty weight log says nothing", async () => {
  const { store, view, now } = await cohort();
  const aisha = view("aisha");
  const g = homeGuidance(aisha, now);
  clean(g, "aisha home");
  assert.equal(g.id, "usual");
  assert.match(g.title, /discharge plan/);
  assert.match(
    g.body,
    /All three readings watched after atrial fibrillation are about your usual/,
  );
  assert.equal(g.cta.href, "#/patient/readings");
  assert.match(g.evidence, /Apple Watch/);
  for (const s of aisha.signals) {
    const m = metricGuidance(s, aisha, now);
    if (s.id === "weight") assert.equal(m, null, "no weight was ever entered");
    else {
      clean(m, `aisha ${s.id}`);
      assert.equal(m.id, "usual");
      assert.doesNotMatch(m.body, /walk|check-in/i);
    }
  }
  store.destroy();
});

test("no patient in the cohort is ever diagnosed, judged, or told about a measurement they lack", async () => {
  const { store, view } = await cohort();
  const s = store.getState();
  for (const id of s.order) {
    const p = view(id);
    const g = homeGuidance(p, s.now);
    assert.ok(g, `${id} gets one insight`);
    assert.ok(!Array.isArray(g), "exactly one, never a list");
    clean(g, `${id} home`);
    assert.ok(g.cta?.href, `${id}: the card always links somewhere`);
    for (const signal of p.signals) {
      const m = metricGuidance(signal, p, s.now);
      if (signal.usual === null)
        assert.equal(m, null, `${id}/${signal.id}: no usual, no advice`);
      else clean(m, `${id}/${signal.id}`);
    }
  }
  store.destroy();
});

test("a moved vital asks for the check-in when one is due, and for the discharge instructions otherwise", () => {
  const signals = [
    sig("restingHr", { usual: 62, today: 70, todayLevel: 2, moved: true }),
    usual("breathing", 14.2),
    usual("oxygen", 96.8),
    usual("skinTemp", 33.9),
  ];
  // The readings have made a check-in due.
  const p = patient(signals, { pattern: true, hours: 26 });
  const g = homeGuidance(p, NOW);
  clean(g, "vital moved");
  assert.equal(g.id, "checkin");
  assert.equal(g.cta.href, "#/patient/checkin");
  assert.match(
    g.body,
    /Your resting heart rate has been higher than your usual since day 8 \(70 against 62 bpm\)/,
  );
  assert.doesNotMatch(g.body, /walk|exercise|eat|drink/i);
  assert.equal(
    g.evidence,
    "Based on resting heart rate from your Apple Watch, compared with your usual before your stay.",
  );

  // Answered three hours ago: the care team has it, so the step is the letter.
  const answered = {
    requestedAt: NOW - 4 * HOUR,
    answeredAt: NOW - 3 * HOUR,
    kind: "priority",
    answers: {},
  };
  const settled = homeGuidance(
    patient(signals, {
      pattern: true,
      hours: 26,
      checkins: [answered],
      answered,
    }),
    NOW,
  );
  clean(settled, "vital answered");
  assert.equal(settled.id, "settle");
  assert.match(settled.title, /discharge instructions/);
  assert.match(
    settled.body,
    /Your care team has your check-in from 3 hours ago/,
  );
  assert.equal(settled.cta.label, "Check in again");

  // One vital on its own, below what this pathway counts as a pattern: the
  // letter again, and a check-in offered rather than demanded.
  const single = homeGuidance(patient(signals), NOW);
  clean(single, "single vital");
  assert.equal(single.id, "settle");
  assert.match(single.body, /Your care team can see your readings/);
  assert.match(single.body, /check in if you feel unwell/);
  assert.equal(single.cta.label, "Check in");
  assert.equal(metricGuidance(signals[0], patient(signals), NOW).id, "settle");
});

test("coordinated unusual readings and a model finding both lead to the check-in", () => {
  const signals = [
    sig("restingHr", { usual: 62, today: 70, todayLevel: 2, moved: true }),
    sig("breathing", { usual: 14.2, today: 16, todayLevel: 2, moved: true }),
    usual("oxygen", 96.8),
  ];
  const coordinated = homeGuidance(
    patient(signals, { pattern: true, hours: 30 }),
    NOW,
  );
  assert.equal(coordinated.id, "checkin");
  assert.match(
    coordinated.body,
    /One other reading has moved with it, for about 30 hours/,
  );

  const model = homeGuidance(
    patient([usual("restingHr", 62), usual("breathing", 14.2)], {
      analysis: { application_state: "context_needed", is_anomalous: true },
    }),
    NOW,
  );
  clean(model, "model only");
  assert.equal(model.id, "checkin");
  assert.match(model.body, /Relay's model found a pattern/);
});

test("fewer steps with usual vitals suggests one short walk, conditioned on the plan, with a stop rule", () => {
  const p = patient(
    [
      sig("steps", {
        usual: 6200,
        today: 3900,
        todayLevel: 2,
        moved: true,
        runStart: 8,
      }),
      usual("walkingSpeed", 1.07),
      usual("restingHr", 62),
    ],
    { profileId: "jointReplacement", profile: PROFILES.jointReplacement },
  );
  const g = homeGuidance(p, NOW);
  clean(g, "steps");
  assert.equal(g.id, "activity");
  assert.match(
    g.body,
    /Your steps in a day have been fewer than your usual since day 9 \(3900 against 6200 steps\)/,
  );
  assert.match(g.body, /If your discharge plan allows activity/);
  assert.match(g.body, /one short walk or the exercises you were given/);
  assert.match(g.body, /Stop and rest if you feel worse/);
  assert.equal(
    g.evidence,
    "Based on daily steps from your iPhone Health app, compared with your usual before your stay.",
  );
  assert.equal(g.cta.href, "#/patient/readings/steps");
  // Slower walking reads the same way.
  const slow = metricGuidance(
    sig("walkingSpeed", {
      usual: 1.07,
      today: 0.9,
      todayLevel: 2,
      moved: true,
    }),
    p,
    NOW,
  );
  assert.equal(slow.id, "activity");
  assert.match(slow.body, /How fast you walk has been slower than your usual/);
});

test("a walk is never suggested while a vital is away from usual, even a little", () => {
  const p = patient([
    sig("steps", { usual: 6200, today: 3900, todayLevel: 2, moved: true }),
    sig("restingHr", { usual: 62, today: 66, todayLevel: 1, towardDays: 1 }),
  ]);
  const g = homeGuidance(p, NOW);
  clean(g, "steps with drifting vital");
  assert.notEqual(g.id, "activity");
  assert.doesNotMatch(g.body, /walk today|short walk/i);
  assert.match(g.title, /discharge plan/);
  assert.match(
    g.body,
    /Daily steps fewer since day 8 and resting heart rate higher for one day/,
  );
  const m = metricGuidance(p.signals[0], p, NOW);
  assert.notEqual(m.id, "activity");
});

test("shorter sleep, more pain and a heavier morning weight each get their own gentle step", () => {
  const base = [usual("restingHr", 62), usual("breathing", 14.2)];
  const sleep = homeGuidance(
    patient([
      ...base,
      sig("sleep", {
        usual: 7.2,
        today: 5.8,
        todayLevel: 1,
        towardDays: 2,
        counted: false,
      }),
    ]),
    NOW,
  );
  clean(sleep, "sleep");
  assert.equal(sleep.id, "sleep");
  assert.match(
    sleep.body,
    /shorter than your usual for two nights \(5\.8 against 7\.2 hours\)/,
  );
  assert.match(sleep.body, /consistent bedtime/);
  assert.match(sleep.body, /caffeine late in the day/);
  assert.equal(sleep.cta.href, "#/patient/readings/sleep");

  const pain = homeGuidance(
    patient([
      ...base,
      sig("pain", {
        usual: 3,
        today: 6,
        todayLevel: 2,
        moved: true,
        counted: false,
      }),
    ]),
    NOW,
  );
  clean(pain, "pain");
  assert.equal(pain.id, "pain");
  assert.match(
    pain.body,
    /Your pain has been higher than your usual since day 8 \(6 against 3 out of 10\)/,
  );
  assert.match(pain.body, /as prescribed/);
  assert.match(
    pain.body,
    /getting worse rather than better, complete a check-in/,
  );
  assert.equal(
    pain.cta.href,
    "#/patient/checkin",
    "worsening pain links to the check-in",
  );
  assert.equal(
    pain.evidence,
    "Based on the pain you entered, compared with your usual before your stay.",
  );

  const weight = homeGuidance(
    patient(
      [
        ...base,
        sig("weight", { usual: 78, today: 80.5, todayLevel: 3, moved: true }),
      ],
      { profileId: "heartFailure", profile: PROFILES.heartFailure },
    ),
    NOW,
  );
  clean(weight, "weight");
  assert.equal(weight.id, "weight");
  assert.match(
    weight.body,
    /heavier than your usual since day 8 \(80\.5 against 78\.0 kg\)/,
  );
  assert.match(weight.body, /same scale, same time, before breakfast/);
  assert.match(
    weight.body,
    /any fluid or salt instructions your care team has given you/,
  );
  assert.doesNotMatch(
    weight.body,
    /limit|restrict|avoid/i,
    "no invented restriction",
  );
  // Pain outranks sleep when both are present and neither has moved.
  const both = homeGuidance(
    patient([
      ...base,
      sig("sleep", { usual: 7.2, today: 6.4, todayLevel: 1, towardDays: 1 }),
      sig("pain", { usual: 3, today: 5, todayLevel: 1, towardDays: 1 }),
    ]),
    NOW,
  );
  assert.equal(both.id, "pain");
});

test("a missing wearable reading asks for the device, never for a reading it cannot see", () => {
  const worn = [
    sig("breathing", { usual: 14.2, today: null }),
    sig("restingHr", { usual: 62, today: null }),
    usual("oxygen", 96.8),
  ];
  const g = homeGuidance(patient(worn, { status: "nodata" }), NOW);
  clean(g, "missing watch");
  assert.equal(g.id, "missing");
  assert.equal(g.title, "Wear your Apple Watch tonight");
  assert.match(
    g.body,
    /no breathing rate and resting heart rate reading for last night/,
  );
  assert.match(g.body, /charged, on your wrist and connected/);
  assert.equal(g.cta.href, "#/patient/connect");
  assert.doesNotMatch(
    g.body,
    /higher|lower|faster/i,
    "nothing is said about a value",
  );

  const off = homeGuidance(
    patient([sig("skinTemp", { usual: 33.9, today: null }), ...worn.slice(2)], {
      devices: {
        watch: { name: "Apple Watch", connected: true },
        whoop: { name: "WHOOP", connected: false },
      },
    }),
    NOW,
  );
  assert.equal(off.title, "Reconnect your WHOOP");

  const phone = metricGuidance(
    sig("steps", { usual: 6200, today: null }),
    patient([]),
    NOW,
  );
  assert.equal(phone.title, "Carry your phone with you today");

  const entry = metricGuidance(
    sig("weight", { usual: 78, today: null }),
    patient([]),
    NOW,
  );
  assert.equal(entry.title, "Add today's weight");
  assert.equal(entry.cta.href, "#/patient/readings/weight");
});

test("usual readings reinforce the plan, and a small drift is named without alarm", () => {
  const p = patient([
    usual("breathing", 14.2),
    usual("restingHr", 62),
    usual("skinTemp", 33.9),
    usual("oxygen", 96.8),
  ]);
  const g = homeGuidance(p, NOW);
  clean(g, "usual");
  assert.equal(g.id, "usual");
  assert.equal(g.title, "Keep to your discharge plan and your routine today");
  assert.match(
    g.body,
    /All four readings watched after pneumonia are about your usual\. Nothing to change today\./,
  );
  assert.equal(g.cta.href, "#/patient/readings");
  assert.equal(metricGuidance(p.signals[0], p, NOW).id, "usual");

  const drift = homeGuidance(
    patient([
      ...p.signals.slice(1),
      sig("breathing", {
        usual: 14.2,
        today: 15.2,
        todayLevel: 1,
        towardDays: 1,
      }),
    ]),
    NOW,
  );
  clean(drift, "drift");
  assert.equal(drift.id, "watch");
  assert.match(
    drift.body,
    /Breathing rate faster for one night, but not by much/,
  );
  assert.match(drift.body, /Nothing to change today/);
});

test("a check-in the care team asked for is the step when the readings say nothing", () => {
  const pending = { requestedAt: NOW - HOUR, answeredAt: null, answers: {} };
  const g = homeGuidance(
    patient([usual("restingHr", 62)], { pending, checkins: [pending] }),
    NOW,
  );
  clean(g, "asked");
  assert.equal(g.id, "asked");
  assert.equal(g.cta.href, "#/patient/checkin");
});

test("a reading the record does not hold never produces advice", () => {
  const ghost = sig("glucose", {
    usual: 5.5,
    today: 9,
    todayLevel: 3,
    moved: true,
  });
  const p = patient([usual("restingHr", 62), ghost]);
  assert.equal(metricGuidance(ghost, p, NOW), null, "unknown signal, moved");
  assert.equal(
    metricGuidance(
      sig("cholesterol", { usual: 4, today: 7, moved: true }),
      p,
      NOW,
    ),
    null,
  );
  const g = homeGuidance(p, NOW);
  assert.equal(g.id, "usual");
  assert.ok(!g.signals.includes("glucose"));
  // A pathway signal with no baseline: nothing to compare, nothing to say.
  const noUsual = sig("weight", { usual: null, today: null });
  assert.equal(metricGuidance(noUsual, p, NOW), null);
  assert.equal(
    metricGuidance(sig("weight", { usual: null, today: 80 }), p, NOW),
    null,
  );
  assert.ok(
    !homeGuidance(patient([...p.signals, noUsual]), NOW).signals.includes(
      "weight",
    ),
  );
  // Nothing comparable at all: no card rather than an invented one.
  assert.equal(homeGuidance(patient([noUsual]), NOW), null);
});

test("observations name the reading, the direction, the span and the numbers", () => {
  assert.equal(
    observation(
      sig("oxygen", { usual: 96.8, today: 94.5, moved: true, runStart: 8 }),
    ),
    "Your blood oxygen has been lower than your usual since day 9 (94.5% against 96.8%)",
  );
  assert.equal(
    observation(
      sig("steadiness", { usual: 94, today: 88, towardDays: 3, todayLevel: 1 }),
    ),
    "Steadiness on your feet has been less steady than your usual for three days (88% against 94%)",
  );
});

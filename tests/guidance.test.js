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
const { homeGuidance, metricGuidance, observation, CHECKIN_HREF } =
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
const tips = (g) => (g.tips || []).map((t) => t.text);
const text = (g) => [g.title, g.lead, ...tips(g), g.evidence].join(" ");
const clean = (g, label) => {
  assert.ok(g, `${label}: guidance exists`);
  assert.doesNotMatch(text(g), FORBIDDEN, `${label}: ${text(g)}`);
  assert.ok(g.title && g.lead && g.evidence, `${label}: title, lead, evidence`);
  assert.ok(Array.isArray(g.tips), `${label}: tips is a list`);
  assert.match(g.evidence, /^Based on/, `${label}: evidence`);
};
const someTip = (g, re) => tips(g).some((t) => re.test(t));

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
    medications: [
      "Amoxicillin 500 mg, three times a day, 5 more days",
      "Paracetamol 1 g, up to four times a day, as needed",
    ],
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

test("the demo patient with four moved vitals gets a list of what helps, and no second check-in button", async () => {
  const { store, view, now } = await cohort();
  const maya = view("maya");
  const g = homeGuidance(maya, now);
  clean(g, "maya home");
  assert.equal(g.id, "act");
  assert.equal(g.tone, "attention");
  assert.equal(g.title, "What you can do today");
  assert.match(
    g.lead,
    /^Your breathing while asleep has been faster than your usual since day 9 \(16\.5 against 14\.2 per min\)\. Four other readings have moved with it, for about \d+ hours, and three more are a little away from your usual\.$/,
  );
  assert.ok(someTip(g, /regular bedtime/), "her shorter sleep gets its line");
  const thermometer = g.tips.find((t) => /own thermometer/.test(t.text));
  assert.equal(thermometer?.href, "#/patient/readings/temperature");
  assert.ok(g.tips.length >= 4 && g.tips.length <= 6, `${g.tips.length} tips`);
  assert.ok(someTip(g, /rest more than usual and avoid heavy effort/));
  assert.ok(someTip(g, /Sit upright rather than lying flat/));
  assert.ok(someTip(g, /Skip caffeine and alcohol today/));
  assert.ok(
    someTip(
      g,
      /exactly as prescribed, and nothing extra: Amoxicillin 500 mg and Paracetamol 1 g/,
    ),
  );
  assert.ok(!someTip(g, /walk|exercise/i), "vitals never lead to exercise");
  assert.notEqual(g.cta.href, CHECKIN_HREF, "the banner owns the check-in");
  assert.ok(g.tips.every((t) => t.href !== CHECKIN_HREF));
  assert.match(g.evidence, /Apple Watch and WHOOP/);
  // Under the charts: the vital keeps a check-in link (no banner there), sleep
  // gets its own advice, and the temperature she never entered gets nothing.
  const by = Object.fromEntries(maya.signals.map((s) => [s.id, s]));
  const breathing = metricGuidance(by.breathing, maya, now);
  clean(breathing, "maya breathing");
  assert.equal(breathing.cta.href, CHECKIN_HREF);
  assert.ok(breathing.tips.length <= 3);
  const sleep = metricGuidance(by.sleep, maya, now);
  clean(sleep, "maya sleep");
  assert.match(
    sleep.lead,
    /sleep has been shorter than your usual since day 9 \(5\.9 against 7\.2 hours\)/,
  );
  assert.ok(
    someTip(
      sleep,
      /regular bedtime tonight and avoid caffeine late in the day/,
    ),
  );
  assert.equal(metricGuidance(by.temperature, maya, now), null);
  store.destroy();
});

test("the quiet demo patient is told to keep to the plan, with the plan's own items", async () => {
  const { store, view, now } = await cohort();
  const aisha = view("aisha");
  const g = homeGuidance(aisha, now);
  clean(g, "aisha home");
  assert.equal(g.id, "usual");
  assert.equal(g.tone, "calm");
  assert.match(
    g.lead,
    /All three readings watched after atrial fibrillation are about your usual/,
  );
  assert.ok(
    someTip(
      g,
      /Take your medicines as listed: Apixaban 5 mg and Bisoprolol 5 mg/,
    ),
  );
  assert.ok(someTip(g, /Wear your Apple Watch tonight/));
  assert.ok(someTip(g, /next check-in is on day 23/));
  assert.equal(g.cta.href, "#/patient/readings");
  for (const s of aisha.signals) {
    const m = metricGuidance(s, aisha, now);
    if (s.id === "weight") assert.equal(m, null, "no weight was ever entered");
    else {
      clean(m, `aisha ${s.id}`);
      assert.equal(m.id, "usual");
      assert.equal(m.tips.length, 0);
    }
  }
  store.destroy();
});

test("no patient in the cohort is diagnosed, judged, told about a measurement they lack, or given a second check-in button", async () => {
  const { store, view } = await cohort();
  const s = store.getState();
  for (const id of s.order) {
    const p = view(id);
    const g = homeGuidance(p, s.now);
    assert.ok(g, `${id} gets one insight`);
    assert.ok(!Array.isArray(g), "exactly one, never a list of cards");
    clean(g, `${id} home`);
    assert.ok(g.cta?.href, `${id}: the card always links somewhere`);
    assert.notEqual(
      g.cta.href,
      CHECKIN_HREF,
      `${id}: Home never adds a check-in button`,
    );
    if (g.id !== "usual")
      assert.ok(g.tips.length > 0, `${id}: something to do`);
    for (const signal of p.signals) {
      const m = metricGuidance(signal, p, s.now);
      if (signal.usual === null)
        assert.equal(m, null, `${id}/${signal.id}: no usual, no advice`);
      else clean(m, `${id}/${signal.id}`);
    }
  }
  store.destroy();
});

test("a moved vital brings rest, posture or stimulant tips and the medicines, never exercise", () => {
  const signals = [
    sig("restingHr", { usual: 62, today: 70, todayLevel: 2, moved: true }),
    usual("breathing", 14.2),
    usual("oxygen", 96.8),
    usual("skinTemp", 33.9),
  ];
  const p = patient(signals, { pattern: true, hours: 26 });
  const g = homeGuidance(p, NOW);
  clean(g, "vital moved");
  assert.equal(g.id, "act");
  assert.equal(g.tone, "attention");
  assert.equal(
    g.lead,
    "Your resting heart rate has been higher than your usual since day 8 (70 against 62 bpm).",
  );
  assert.deepEqual(tips(g), [
    "Take it easy today: rest more than usual and avoid heavy effort.",
    "Take your medicines exactly as prescribed, and nothing extra: Amoxicillin 500 mg and Paracetamol 1 g.",
    "Skip caffeine and alcohol today, and rest between activities.",
  ]);
  assert.equal(g.cta.href, "#/patient/readings/restingHr");
  assert.equal(
    g.evidence,
    "Based on resting heart rate from your Apple Watch, compared with your usual before your stay.",
  );
  // The same reading under its chart links to the check-in that is due there.
  const m = metricGuidance(signals[0], p, NOW);
  assert.equal(m.cta.href, CHECKIN_HREF);
  assert.equal(m.cta.primary, true);
  // Answered: the link softens to "again".
  const answered = {
    requestedAt: NOW - 4 * HOUR,
    answeredAt: NOW - 3 * HOUR,
    kind: "priority",
    answers: {},
  };
  const again = metricGuidance(
    signals[0],
    patient(signals, { pattern: true, checkins: [answered], answered }),
    NOW,
  );
  assert.equal(again.cta.label, "Check in again");
  // Without medicines on the record, nothing about medicines is invented.
  const noMeds = homeGuidance(patient(signals, { medications: [] }), NOW);
  assert.ok(!someTip(noMeds, /medicines/));
});

test("a warmer wrist suggests taking a real temperature when the pathway records one", () => {
  const p = patient([
    sig("skinTemp", { usual: 33.9, today: 34.6, todayLevel: 2, moved: true }),
    usual("breathing", 14.2),
    sig("temperature", { usual: 36.8, today: null, counted: false }),
  ]);
  const g = homeGuidance(p, NOW);
  clean(g, "skin temp");
  const t = g.tips.find((x) => /own thermometer/.test(x.text));
  assert.ok(t, "a thermometer tip");
  assert.equal(t.href, "#/patient/readings/temperature");
  assert.ok(!someTip(g, /Dress lightly/), "one line for the wrist, not two");
  // Already entered today: the things that keep a temperature down instead.
  const entered = homeGuidance(
    patient([
      p.signals[0],
      p.signals[1],
      sig("temperature", { usual: 36.8, today: 37.0, counted: false }),
    ]),
    NOW,
  );
  assert.ok(!someTip(entered, /own thermometer/));
  assert.ok(someTip(entered, /Dress lightly and keep the room cool/));
  // A pathway that records no temperature at all gets the same.
  const noThermometer = homeGuidance(
    patient([p.signals[0], p.signals[1]]),
    NOW,
  );
  assert.ok(someTip(noThermometer, /Dress lightly/));
});

test("coordinated readings and a model finding still produce a list, with the hours", () => {
  const signals = [
    sig("restingHr", { usual: 62, today: 70, todayLevel: 2, moved: true }),
    sig("breathing", { usual: 14.2, today: 16, todayLevel: 2, moved: true }),
    usual("oxygen", 96.8),
  ];
  const g = homeGuidance(patient(signals, { pattern: true, hours: 30 }), NOW);
  assert.match(
    g.lead,
    /One other reading has moved with it, for about 30 hours\.$/,
  );
  assert.ok(someTip(g, /Sit upright/));
  assert.ok(someTip(g, /Skip caffeine/));
  // The model alone, with every reading usual, changes nothing on the card: the
  // banner carries the model's request.
  const model = homeGuidance(
    patient([usual("restingHr", 62), usual("breathing", 14.2)], {
      analysis: { application_state: "context_needed", is_anomalous: true },
    }),
    NOW,
  );
  clean(model, "model only");
  assert.equal(model.id, "usual");
  assert.notEqual(model.cta.href, CHECKIN_HREF);
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
  assert.equal(g.id, "act");
  assert.equal(g.tone, "action");
  assert.equal(
    g.lead,
    "Your steps in a day have been fewer than your usual since day 9 (3900 against 6200 steps).",
  );
  assert.ok(
    someTip(
      g,
      /^If your discharge plan allows activity, take one short walk or do your prescribed exercises\. Stop and rest if you feel worse\.$/,
    ),
  );
  assert.equal(
    g.evidence,
    "Based on daily steps from your iPhone Health app, compared with your usual before your stay.",
  );
  assert.equal(g.cta.href, "#/patient/readings/steps");
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
  assert.match(slow.lead, /How fast you walk has been slower than your usual/);
  assert.ok(someTip(slow, /one short walk/));
  assert.equal(slow.cta, null, "activity never links to the check-in");
});

test("a walk is never suggested while a vital is away from usual, even a little", () => {
  const p = patient([
    sig("steps", { usual: 6200, today: 3900, todayLevel: 2, moved: true }),
    sig("restingHr", { usual: 62, today: 66, todayLevel: 1, towardDays: 1 }),
  ]);
  const g = homeGuidance(p, NOW);
  clean(g, "steps with drifting vital");
  assert.match(
    g.lead,
    /^Your steps in a day have been fewer than your usual since day 8 \(3900 against 6200 steps\)\. One other reading is a little away from your usual too\.$/,
  );
  assert.ok(someTip(g, /Keep activity light today/));
  assert.ok(!someTip(g, /short walk/));
  assert.ok(someTip(g, /Skip caffeine/), "the drifting vital gets its own tip");
  const m = metricGuidance(p.signals[0], p, NOW);
  assert.ok(someTip(m, /Keep activity light today/));
  assert.ok(!someTip(m, /short walk/));
});

test("shorter sleep, more pain and a heavier morning weight each get their own gentle steps", () => {
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
  assert.equal(sleep.tone, "action");
  assert.match(
    sleep.lead,
    /^Your sleep has been shorter than your usual for two nights \(5\.8 against 7\.2 hours\), but not by much\.$/,
  );
  assert.ok(someTip(sleep, /consistent|regular bedtime/));
  assert.ok(someTip(sleep, /caffeine late in the day/));
  assert.equal(sleep.cta.href, "#/patient/readings/sleep");

  const painSignal = sig("pain", {
    usual: 3,
    today: 6,
    todayLevel: 2,
    moved: true,
    counted: false,
  });
  const pain = homeGuidance(patient([...base, painSignal]), NOW);
  clean(pain, "pain");
  assert.match(
    pain.lead,
    /Your pain has been higher than your usual since day 8 \(6 against 3 out of 10\)/,
  );
  assert.ok(someTip(pain, /pain relief as prescribed, and nothing extra/));
  assert.ok(
    someTip(
      pain,
      /getting worse rather than better, tell your care team at your check-in/,
    ),
  );
  assert.notEqual(
    pain.cta.href,
    CHECKIN_HREF,
    "Home leaves the button to the banner",
  );
  assert.equal(
    metricGuidance(painSignal, patient([...base, painSignal]), NOW).cta.href,
    CHECKIN_HREF,
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
      {
        profileId: "heartFailure",
        profile: PROFILES.heartFailure,
      },
    ),
    NOW,
  );
  clean(weight, "weight");
  assert.match(
    weight.lead,
    /heavier than your usual since day 8 \(80\.5 against 78\.0 kg\)/,
  );
  assert.ok(
    someTip(
      weight,
      /^Weigh again tomorrow: same scale, same time, before breakfast\.$/,
    ),
  );
  assert.ok(
    someTip(
      weight,
      /any fluid or salt instructions your care team has given you/,
    ),
  );
  assert.ok(
    !someTip(weight, /limit|restrict|avoid/i),
    "no invented restriction",
  );
});

test("missing wearable readings ask for the device, never for a reading it cannot see", () => {
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
    g.lead,
    /no breathing rate and resting heart rate reading for last night/,
  );
  assert.ok(someTip(g, /Charge it before bed/));
  assert.equal(g.cta.href, "#/patient/connect");
  assert.doesNotMatch(
    text(g),
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

  assert.equal(
    metricGuidance(sig("steps", { usual: 6200, today: null }), patient([]), NOW)
      .title,
    "Carry your phone with you today",
  );
  const entry = metricGuidance(
    sig("weight", { usual: 78, today: null }),
    patient([]),
    NOW,
  );
  assert.equal(entry.title, "Add today's weight");
  assert.equal(entry.cta.href, "#/patient/readings/weight");

  // One reading missing from an otherwise complete night becomes a line in the
  // list rather than the whole card.
  const one = homeGuidance(
    patient([
      sig("skinTemp", { usual: 33.9, today: null }),
      usual("breathing", 14.2),
      usual("restingHr", 62),
      usual("oxygen", 96.8),
    ]),
    NOW,
  );
  assert.equal(one.id, "usual");
  const t = one.tips.find((x) =>
    /no skin temperature reading arrived last night/.test(x.text),
  );
  assert.ok(t && t.href === "#/patient/connect");
});

test("usual readings reinforce the plan with the record's own items, and a small drift is named without alarm", () => {
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
    g.lead,
    /^All four readings watched after pneumonia are about your usual\. Nothing to change today\.$/,
  );
  assert.deepEqual(tips(g), [
    "Take your medicines as listed: Amoxicillin 500 mg and Paracetamol 1 g.",
    "Wear your Apple Watch and WHOOP tonight so tomorrow's readings can be compared.",
    "Your next check-in is on day 11.",
  ]);
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
  assert.equal(drift.id, "act");
  assert.equal(drift.tone, "action", "a drift is not amber");
  assert.match(
    drift.lead,
    /faster than your usual for one night \(15\.2 against 14\.2 per min\), but not by much\.$/,
  );
  assert.ok(
    !someTip(drift, /rest more than usual/),
    "rest is for a reading that has moved",
  );
  assert.ok(someTip(drift, /Sit upright/));
});

test("a check-in the care team asked for is left to the banner", () => {
  const pending = { requestedAt: NOW - HOUR, answeredAt: null, answers: {} };
  const g = homeGuidance(
    patient([usual("restingHr", 62)], { pending, checkins: [pending] }),
    NOW,
  );
  clean(g, "asked");
  assert.equal(g.id, "usual");
  assert.notEqual(g.cta.href, CHECKIN_HREF);
  assert.ok(g.tips.every((t) => t.href !== CHECKIN_HREF));
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
  assert.doesNotMatch(text(g), /glucose/);
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

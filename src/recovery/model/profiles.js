// Watch profiles: which signals count toward a review after each illness, in which
// direction, and past what threshold. These are ILLUSTRATIVE demo settings, not
// clinically validated rules. A clinician has to own this table before real use.

// dir is the direction that is watched: +1 higher than usual, -1 lower than usual.
// thr is how far from usual counts: { pct } of usual, or { abs } in the signal's unit.
export const SIGNALS = {
  breathing: {
    name: "Breathing rate, asleep",
    short: "breathing rate",
    unit: "per min",
    digits: 1,
    device: "watch",
    dir: 1,
    thr: { pct: 10 },
    plain: "Breathing while asleep",
    what: "How many breaths you take each minute during the night.",
    up: "Faster",
    down: "Slower",
    span: "nights",
  },
  oxygen: {
    name: "Blood oxygen",
    short: "blood oxygen",
    unit: "%",
    digits: 1,
    device: "watch",
    dir: -1,
    thr: { abs: 2 },
    plain: "Blood oxygen",
    what: "How much oxygen your blood is carrying.",
    up: "Higher",
    down: "Lower",
    span: "nights",
  },
  restingHr: {
    name: "Resting heart rate",
    short: "resting heart rate",
    unit: "bpm",
    digits: 0,
    device: "watch",
    dir: 1,
    thr: { pct: 10 },
    plain: "Resting heart rate",
    what: "How fast your heart beats when you are sitting still or asleep.",
    up: "Higher",
    down: "Lower",
    span: "days",
  },
  skinTemp: {
    name: "Skin temperature",
    short: "skin temperature",
    unit: "°C",
    digits: 1,
    device: "whoop",
    dir: 1,
    thr: { abs: 0.5 },
    plain: "Skin temperature",
    what: "Measured at your wrist while you sleep.",
    up: "Warmer",
    down: "Cooler",
    span: "nights",
  },
  hrv: {
    name: "Heart rate variability",
    short: "heart rate variability",
    unit: "ms",
    digits: 0,
    device: "watch",
    dir: -1,
    thr: { pct: 15 },
    plain: "Heart rhythm steadiness",
    what: "How much the time between your heartbeats varies while you rest.",
    up: "Higher",
    down: "Lower",
    span: "nights",
  },
  sleep: {
    name: "Sleep duration",
    short: "sleep",
    unit: "hours",
    digits: 1,
    device: "watch",
    dir: -1,
    thr: { pct: 15 },
    plain: "Sleep",
    what: "How long you slept.",
    up: "Longer",
    down: "Shorter",
    span: "nights",
  },
  deepSleep: {
    name: "Deep sleep",
    short: "deep sleep",
    unit: "hours",
    digits: 2,
    device: "watch",
    dir: -1,
    thr: { pct: 25 },
    plain: "Deep sleep",
    what: "How much of your sleep was deep sleep.",
    up: "More",
    down: "Less",
    span: "nights",
  },
  walkingHr: {
    name: "Walking heart rate",
    short: "walking heart rate",
    unit: "bpm",
    digits: 0,
    device: "watch",
    dir: 1,
    thr: { pct: 8 },
    plain: "Heart rate when walking",
    what: "How fast your heart beats on an ordinary walk.",
    up: "Higher",
    down: "Lower",
    span: "days",
  },
  temperature: {
    name: "Temperature",
    short: "temperature",
    unit: "°C",
    digits: 1,
    device: "manual",
    dir: 1,
    thr: { abs: 0.6 },
    plain: "Temperature",
    what: "Taken with your own thermometer and entered by you.",
    up: "Higher",
    down: "Lower",
    span: "days",
    manual: { min: 34, max: 42, step: 0.1, hint: "36.5 to 37.5 is typical" },
  },
  weight: {
    name: "Morning weight",
    short: "weight",
    unit: "kg",
    digits: 1,
    device: "manual",
    dir: 1,
    thr: { abs: 1.5 },
    plain: "Morning weight",
    what: "Weighed each morning before breakfast and entered by you.",
    up: "Heavier",
    down: "Lighter",
    span: "days",
    manual: {
      min: 30,
      max: 250,
      step: 0.1,
      hint: "Same scale, same time each day",
    },
  },
  pain: {
    name: "Pain score",
    short: "pain",
    unit: "/10",
    digits: 0,
    device: "manual",
    dir: 1,
    thr: { abs: 2 },
    plain: "Pain",
    what: "How much it hurts right now, from 0 (none) to 10 (worst).",
    up: "More",
    down: "Less",
    span: "days",
    manual: { min: 0, max: 10, step: 1, hint: "0 is no pain, 10 is the worst" },
  },
  avgHr: {
    name: "Daily average heart rate",
    short: "average heart rate",
    unit: "bpm",
    digits: 0,
    device: "watch",
    dir: 1,
    thr: { pct: 10 },
    plain: "Average heart rate",
    what: "Your average heartbeat across the whole day.",
    up: "Higher",
    down: "Lower",
    span: "days",
  },
};

const NYS = ["No", "Yes", "Not sure"];
const SCALE = ["No", "A little", "A lot"];
// Every question maps onto a field of the ML model's structured context
// (ml/vesper_ml/programs.py), so an answer given here can be scored there.
// `ml` is the field, `toModel` turns the chosen option into the model's value.
// `reports` is how a concerning answer reads in the doctor's summary.
const worse = (a) =>
  a === "No" ? "Unchanged" : a === "Not sure" ? "Unsure" : "Worsening";
const yes = (a) => (a === "Yes" ? true : a === "No" ? false : null);
export const QUESTIONS = {
  breathing: {
    text: "Is your breathing harder when you walk or climb stairs than yesterday?",
    short: "Breathing with usual activity",
    options: SCALE,
    reports: "harder breathing",
    ml: "shortness_of_breath",
    toModel: (a) => (a === "No" ? false : true),
  },
  cough: {
    text: "Are you coughing more, or bringing up more mucus, than yesterday?",
    short: "Cough or mucus change",
    options: SCALE,
    reports: "more coughing",
    ml: "cough",
    toModel: worse,
  },
  fever: {
    text: "Have you had a fever or chills since you came home?",
    short: "Fever or chills since discharge",
    options: NYS,
    reports: "fever or chills",
    ml: "fever_symptoms",
    toModel: yes,
  },
  swelling: {
    text: "Are your ankles, feet, or legs more swollen than yesterday?",
    short: "Swelling in ankles or legs",
    options: SCALE,
    reports: "more swelling",
    ml: "swelling",
    toModel: worse,
  },
  pain: {
    text: "Is the pain around your incision worse than yesterday?",
    short: "Incision pain since discharge",
    options: SCALE,
    reports: "worse wound pain",
    ml: "pain_change",
    toModel: (a) => (a === "No" ? "Same" : "Worse"),
  },
  wound: {
    text: "Does the wound look red, swollen, or leaking?",
    short: "Wound red, swollen, or leaking",
    options: NYS,
    reports: "a wound concern",
    ml: "wound_concern",
    toModel: yes,
  },
  nausea: {
    text: "Have you felt sick or vomited today?",
    short: "Felt sick or vomited",
    options: NYS,
    reports: "nausea or vomiting",
    ml: "nausea_vomiting",
    toModel: yes,
  },
  mucus: {
    text: "Has your mucus changed colour or increased?",
    short: "Mucus changed or increased",
    options: NYS,
    reports: "a change in mucus",
    ml: "mucus_change",
    toModel: yes,
  },
  inhaler: {
    text: "Have you used your rescue inhaler more than usual?",
    short: "More rescue inhaler than usual",
    options: NYS,
    reports: "more inhaler use",
    ml: "inhaler_use",
    toModel: (a) =>
      a === "Yes" ? "More than usual" : a === "No" ? "Usual" : "Unsure",
  },
  oxygen: {
    text: "Have you skipped any of your prescribed oxygen?",
    short: "Skipped prescribed oxygen",
    options: NYS,
    reports: "skipped oxygen",
    ml: "oxygen_use",
    toModel: (a) =>
      a === "Yes" ? "Skipped" : a === "No" ? "As prescribed" : "Unsure",
  },
  hydration: {
    text: "Are you drinking less than usual?",
    short: "Drinking less than usual",
    options: NYS,
    reports: "drinking less",
    ml: "hydration",
    toModel: (a) =>
      a === "Yes" ? "Less than usual" : a === "No" ? "Usual" : "Unsure",
  },
  racing: {
    text: "Have you felt your heart racing, fluttering, or beating irregularly?",
    short: "Racing or irregular heartbeat",
    options: NYS,
    reports: "a racing heart",
    ml: "chest_symptoms",
    toModel: yes,
  },
  chest: {
    text: "Any chest pain or pressure today?",
    short: "Chest pain or pressure",
    options: NYS,
    reports: "chest pain or pressure",
    ml: "chest_symptoms",
    toModel: yes,
  },
  dizziness: {
    text: "Have you felt dizzy or faint?",
    short: "Dizzy or faint",
    options: NYS,
    reports: "dizziness",
    ml: "dizziness",
    toModel: yes,
  },
  fatigue: {
    text: "Are you more tired than yesterday?",
    short: "More tired than yesterday",
    options: SCALE,
    reports: "more tiredness",
    ml: "fatigue",
    toModel: worse,
  },
  bleeding: {
    text: "Has your bleeding been heavier than yesterday?",
    short: "Heavier bleeding than yesterday",
    options: SCALE,
    reports: "heavier bleeding",
    ml: "bleeding",
    toModel: worse,
  },
  headache: {
    text: "Have you had a headache or changes to your vision?",
    short: "Headache or vision changes",
    options: NYS,
    reports: "headache or vision changes",
    ml: "headache",
    toModel: yes,
  },
  sleepiness: {
    text: "Have you felt sleepy during the day?",
    short: "Sleepy during the day",
    options: SCALE,
    reports: "daytime sleepiness",
    ml: "sleepiness",
    toModel: worse,
  },
  medicine: {
    text: "Have you missed, changed, or stopped any medicines from your discharge plan?",
    short: "Medicine changes since discharge",
    options: NYS,
    reports: "missed medicines",
    ml: "medication",
    toModel: (a) =>
      a === "Yes" ? "Missed or changed" : a === "No" ? "No changes" : "Unsure",
  },
  activity: {
    text: "Were you more active than your discharge plan recommended?",
    short: "Activity beyond discharge plan",
    options: NYS,
    ml: "exercise",
    toModel: (a) =>
      a === "Yes"
        ? "Recent exercise"
        : a === "No"
          ? "No unusual activity"
          : "Unsure",
  },
};

// Turn a check-in into the structured context the ML model scores.
// Adherence questions feed both the common field and the program's own one.
export function toModelContext(profileId, answers) {
  const context = { consent: true };
  for (const [q, a] of Object.entries(answers || {})) {
    const def = QUESTIONS[q];
    if (!def || a === undefined) continue;
    const value = def.toModel(a);
    if (
      context[def.ml] === undefined ||
      value === true ||
      value === "Worsening"
    )
      context[def.ml] = value;
  }
  const adherence = PROFILES[profileId]?.adherence;
  if (adherence && context.medication !== undefined)
    context[adherence] = context.medication;
  return context;
}

// How often the patient is asked: every day for the first week at home, then every
// other day to the end of the window. The model can ask in between.
export const SCHEDULE = { dailyUntil: 7, thenEvery: 2, windowDays: 30 };
export const isScheduledDay = (day) =>
  day <= SCHEDULE.dailyUntil ||
  (day <= SCHEDULE.windowDays &&
    (day - SCHEDULE.dailyUntil) % SCHEDULE.thenEvery === 0);

// These links make the patient check-in follow the model's observed contributors.
// They are relevance hints only: a matching wearable signal does not prove that a
// symptom caused it. Questions with no direct wearable counterpart (for example
// medicine adherence or wound pain) remain in every program as patient context.
export const QUESTION_SIGNAL_MAP = {
  pneumonia: {
    breathing: ["breathing", "oxygen"],
    fever: ["skinTemp"],
    medicine: [],
    activity: ["walkingHr"],
  },
  heartFailure: {
    breathing: ["breathing", "oxygen"],
    swelling: [],
    medicine: [],
    activity: ["walkingHr", "sleep"],
  },
  abdominalSurgery: {
    pain: [],
    fever: ["skinTemp"],
    medicine: [],
    activity: ["walkingHr"],
  },
  copd: {
    breathing: ["breathing", "oxygen"],
    cough: ["breathing", "oxygen"],
    medicine: [],
    activity: ["walkingHr"],
  },
  afib: {
    racing: ["restingHr", "avgHr", "hrv"],
    breathing: ["breathing"],
    medicine: [],
    activity: ["walkingHr", "avgHr"],
  },
};

const counted = (signal, over = {}) => ({
  signal,
  dir: SIGNALS[signal].dir,
  thr: SIGNALS[signal].thr,
  ...over,
});
export const PROFILES = {
  pneumonia: {
    name: "Pneumonia",
    after: "pneumonia",
    ml: "pneumonia_recovery",
    adherence: "antibiotic_adherence",
    minMoved: 3,
    counted: [
      counted("breathing"),
      counted("restingHr"),
      counted("skinTemp"),
      counted("oxygen"),
    ],
    recorded: ["hrv", "sleep", "deepSleep", "walkingHr", "temperature"],
    questions: [
      "breathing",
      "cough",
      "fever",
      "hydration",
      "fatigue",
      "medicine",
      "activity",
    ],
  },
  heartFailure: {
    name: "Heart failure",
    after: "heart failure",
    ml: "heart_failure_recovery",
    adherence: "diuretic_adherence",
    minMoved: 3,
    counted: [
      counted("restingHr"),
      counted("hrv"),
      counted("breathing"),
      counted("walkingHr"),
      counted("sleep"),
    ],
    recorded: ["oxygen", "deepSleep", "weight"],
    questions: [
      "breathing",
      "swelling",
      "fatigue",
      "dizziness",
      "medicine",
      "activity",
    ],
  },
  abdominalSurgery: {
    name: "Abdominal surgery",
    after: "abdominal surgery",
    ml: "post_abdominal_surgery",
    minMoved: 2,
    counted: [
      counted("restingHr"),
      counted("hrv"),
      counted("breathing"),
      counted("skinTemp"),
    ],
    recorded: ["sleep", "oxygen", "walkingHr", "temperature", "pain"],
    questions: [
      "pain",
      "wound",
      "nausea",
      "breathing",
      "fever",
      "fatigue",
      "medicine",
      "activity",
    ],
  },
  copd: {
    name: "COPD flare-up",
    after: "a COPD flare-up",
    ml: "copd_recovery",
    minMoved: 2,
    counted: [
      counted("breathing"),
      counted("oxygen"),
      counted("walkingHr"),
      counted("sleep"),
    ],
    recorded: ["restingHr", "hrv", "temperature"],
    questions: [
      "breathing",
      "cough",
      "mucus",
      "inhaler",
      "oxygen",
      "fatigue",
      "medicine",
      "activity",
    ],
  },
  sepsisWatch: {
    name: "Sepsis watch after surgery",
    ml: null,
    after: "surgery, with a sepsis watch",
    minMoved: 3,
    counted: [
      counted("restingHr"),
      counted("breathing"),
      counted("skinTemp"),
      counted("hrv"),
    ],
    recorded: ["oxygen", "sleep", "walkingHr"],
    questions: ["fever", "pain", "medicine", "activity"],
  },
  respiratoryInfection: {
    name: "Respiratory infection",
    ml: null,
    after: "a respiratory infection",
    minMoved: 3,
    counted: [
      counted("breathing"),
      counted("skinTemp"),
      counted("oxygen"),
      counted("hrv"),
      counted("restingHr"),
    ],
    recorded: ["sleep", "deepSleep", "walkingHr"],
    questions: ["breathing", "cough", "fever", "activity"],
  },
  asthma: {
    name: "Asthma flare-up",
    ml: null,
    after: "an asthma flare-up",
    minMoved: 2,
    counted: [
      counted("breathing"),
      counted("oxygen"),
      counted("sleep"),
      counted("walkingHr"),
    ],
    recorded: ["restingHr", "hrv"],
    questions: ["breathing", "cough", "medicine", "activity"],
  },
  pulmonaryEmbolism: {
    name: "Pulmonary embolism recovery",
    ml: null,
    after: "a pulmonary embolism",
    minMoved: 2,
    counted: [
      counted("breathing"),
      counted("oxygen"),
      counted("restingHr"),
      counted("walkingHr"),
    ],
    recorded: ["hrv", "sleep"],
    questions: ["breathing", "pain", "medicine", "activity"],
  },
  sleepApnoea: {
    name: "Sleep apnoea, after titration",
    ml: null,
    after: "a sleep apnoea titration",
    minMoved: 2,
    counted: [
      counted("oxygen"),
      counted("deepSleep"),
      counted("sleep"),
      counted("restingHr"),
    ],
    recorded: ["breathing", "hrv"],
    questions: ["sleepiness", "breathing", "medicine", "activity"],
  },
  postpartum: {
    name: "Postpartum recovery",
    ml: null,
    after: "giving birth",
    minMoved: 2,
    counted: [
      counted("restingHr"),
      counted("breathing"),
      counted("sleep"),
      counted("skinTemp"),
    ],
    recorded: ["hrv", "oxygen"],
    questions: ["bleeding", "headache", "fever", "medicine"],
  },
  afib: {
    name: "Atrial fibrillation",
    after: "atrial fibrillation",
    ml: "cardiac_recovery",
    minMoved: 2,
    counted: [counted("restingHr"), counted("hrv"), counted("avgHr")],
    recorded: ["sleep", "breathing", "weight"],
    questions: [
      "racing",
      "chest",
      "dizziness",
      "breathing",
      "fatigue",
      "medicine",
      "activity",
    ],
  },
};

// Model program ideas that are not enabled in the simulated patient feed yet.
// Keeping them separate from PROFILES prevents these cards from implying that
// the current frontend is scoring their metrics or that the programs are validated.
export const PROGRAM_PREVIEWS = [
  {
    id: "strokeRehabilitation",
    name: "Stroke rehabilitation",
    status: "Limited synthetic example",
    summary:
      "Tracks functional recovery trends after discharge. It does not detect or rule out a new stroke.",
    measures: [
      "Walking speed and step length",
      "Walking asymmetry and double-support time",
      "Daily steps and walking steadiness",
    ],
    context: ["Falls", "Dizziness", "Therapy adherence"],
    coverage:
      "A synthetic gait-decline scenario is available. The reference wearable cohort has no gait metrics, so this profile has not been validated on that cohort.",
  },
  {
    id: "cardiacRecovery",
    name: "Cardiac recovery",
    status: "Program draft",
    summary:
      "A planned follow-up profile for recovery after a heart attack, stent procedure, or bypass surgery.",
    measures: [
      "Resting and daily heart rate",
      "Heart rate variability and sleep",
      "Steps, with blood pressure and weight when connected",
    ],
    context: ["Chest symptoms", "Dizziness", "Breathlessness"],
    coverage:
      "The model program is defined, but this prototype has no dedicated patient scenario or connected blood-pressure and weight feed.",
  },
];

export const thresholdOf = (thr, usual) =>
  thr.abs !== undefined ? thr.abs : (Math.abs(usual) * thr.pct) / 100;
export function ruleText({ dir, thr }, unit) {
  const amount =
    thr.abs !== undefined
      ? `${thr.abs} ${unit === "%" ? "points" : unit}`
      : `${thr.pct}%`;
  return `Counted when ${amount} ${dir > 0 ? "higher" : "lower"} for 24 hours.`;
}

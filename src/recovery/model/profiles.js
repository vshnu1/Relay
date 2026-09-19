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
// `reports` is how a concerning answer reads in the doctor's summary.
export const QUESTIONS = {
  breathing: {
    text: "Is your breathing harder than yesterday?",
    short: "Breathing harder than yesterday",
    options: SCALE,
    reports: "harder breathing",
  },
  cough: {
    text: "Are you coughing more than yesterday?",
    short: "Coughing more than yesterday",
    options: SCALE,
    reports: "more coughing",
  },
  fever: {
    text: "Have you had any fever or chills?",
    short: "Fever or chills",
    options: NYS,
    reports: "fever or chills",
  },
  swelling: {
    text: "Are your ankles or legs more swollen than yesterday?",
    short: "More swelling than yesterday",
    options: SCALE,
    reports: "more swelling",
  },
  pain: {
    text: "Is the pain around your wound worse than yesterday?",
    short: "Wound pain worse than yesterday",
    options: SCALE,
    reports: "worse wound pain",
  },
  racing: {
    text: "Have you felt your heart racing or fluttering?",
    short: "Heart racing or fluttering",
    options: NYS,
    reports: "a racing heart",
  },
  medicine: {
    text: "Have you missed any of your medicines?",
    short: "Missed any medicines",
    options: NYS,
    reports: "missed medicines",
  },
  activity: {
    text: "Did you do anything more active than usual today?",
    short: "More active than usual",
    options: NYS,
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
    minMoved: 3,
    counted: [
      counted("breathing"),
      counted("restingHr"),
      counted("skinTemp"),
      counted("oxygen"),
    ],
    recorded: ["hrv", "sleep", "deepSleep", "walkingHr"],
    questions: ["breathing", "fever", "medicine", "activity"],
  },
  heartFailure: {
    name: "Heart failure",
    after: "heart failure",
    minMoved: 3,
    counted: [
      counted("restingHr"),
      counted("hrv"),
      counted("breathing"),
      counted("walkingHr"),
      counted("sleep"),
    ],
    recorded: ["oxygen", "deepSleep"],
    questions: ["breathing", "swelling", "medicine", "activity"],
  },
  abdominalSurgery: {
    name: "Abdominal surgery",
    after: "abdominal surgery",
    minMoved: 2,
    counted: [
      counted("restingHr"),
      counted("hrv"),
      counted("breathing"),
      counted("skinTemp"),
    ],
    recorded: ["sleep", "oxygen", "walkingHr"],
    questions: ["pain", "fever", "medicine", "activity"],
  },
  copd: {
    name: "COPD flare-up",
    after: "a COPD flare-up",
    minMoved: 2,
    counted: [
      counted("breathing"),
      counted("oxygen"),
      counted("walkingHr"),
      counted("sleep"),
    ],
    recorded: ["restingHr", "hrv"],
    questions: ["breathing", "cough", "medicine", "activity"],
  },
  afib: {
    name: "Atrial fibrillation",
    after: "atrial fibrillation",
    minMoved: 2,
    counted: [counted("restingHr"), counted("hrv"), counted("avgHr")],
    recorded: ["sleep", "breathing"],
    questions: ["racing", "breathing", "medicine", "activity"],
  },
};

export const thresholdOf = (thr, usual) =>
  thr.abs !== undefined ? thr.abs : (Math.abs(usual) * thr.pct) / 100;
export function ruleText({ dir, thr }, unit) {
  const amount =
    thr.abs !== undefined
      ? `${thr.abs} ${unit === "%" ? "points" : unit}`
      : `${thr.pct}%`;
  return `Counted when ${amount} ${dir > 0 ? "higher" : "lower"} for 24 hours.`;
}

// A stand-in for the hardware and wearable feeds. It speaks the Source contract in
// contract.js, so replacing it with a real stream changes no other file.
// Every patient here is synthetic.
import { PROFILES, SIGNALS, thresholdOf } from "./profiles.js";

export const HOUR = 3600000;
export const DAY = 24 * HOUR;
const TICK_MS = 3000;
const TYPICAL = {
  breathing: [14.2, 0.6],
  oxygen: [96.8, 0.5],
  restingHr: [62, 1.8],
  skinTemp: [33.9, 0.2],
  hrv: [41, 3],
  sleep: [7.2, 0.4],
  deepSleep: [1.1, 0.12],
  walkingHr: [98, 3],
  avgHr: [74, 2.5],
};
// A story is one character per day at home: how far that day sits from usual, in
// threshold units, toward (digits) or away from (letters) the watched direction. x = no reading.
const RATIO = {
  0: 0.04,
  1: 0.74,
  2: 1.22,
  3: 1.64,
  a: -0.74,
  b: -1.22,
  c: -1.64,
};

const COHORT = [
  {
    id: "maya",
    code: "BAY-2741",
    careEmail: "respiratory.team@bayfront.example",
    name: "Maya Okafor",
    age: 67,
    profile: "pneumonia",
    hospital: "Bayfront Health — Respiratory Unit",
    clinician: "Dr. Elena Ruiz",
    day: 9,
    stay: 5,
    stories: {
      breathing: "2110000123",
      restingHr: "2100000122",
      skinTemp: "1000000022",
      oxygen: "1100000022",
      hrv: "1100000011",
      sleep: "1100a00022",
      deepSleep: "0100000001",
      walkingHr: "1000000011",
    },
    checkins: [
      {
        requested: 9,
        answered: 7.7,
        answers: {
          breathing: "A lot",
          fever: "Not sure",
          medicine: "No",
          activity: "No",
        },
        note: "I get out of breath walking to the kitchen, and the cough is worse at night.",
      },
    ],
  },
  {
    id: "daniel",
    code: "TGH-5580",
    careEmail: "heart.failure.nurses@tampageneral.example",
    name: "Daniel Reyes",
    age: 58,
    profile: "heartFailure",
    hospital: "Tampa General — Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 16,
    stay: 6,
    stories: {
      restingHr: "11223",
      hrv: "1122",
      breathing: "1123",
      walkingHr: "112",
      sleep: "11",
    },
    checkins: [
      {
        requested: 26,
        answered: 21,
        answers: {
          breathing: "A little",
          swelling: "A little",
          medicine: "No",
          activity: "No",
        },
        note: null,
      },
    ],
  },
  {
    id: "priya",
    code: "MMC-1193",
    careEmail: "surgical.followup@mercymedical.example",
    name: "Priya Nair",
    age: 44,
    profile: "abdominalSurgery",
    hospital: "Mercy Medical — General Surgery",
    clinician: "Dr. Sofia Marin",
    day: 6,
    stay: 4,
    stories: {
      restingHr: "2110022",
      hrv: "1100001",
      breathing: "1000000",
      skinTemp: "1000022",
    },
    checkins: [{ requested: 2 }],
  },
  {
    id: "tom",
    code: "LKR-8027",
    careEmail: "pulmonary.team@lakeside.example",
    name: "Tom Lindqvist",
    age: 71,
    profile: "copd",
    hospital: "Lakeside Regional — Pulmonary",
    clinician: "Dr. James Cole",
    day: 12,
    stay: 3,
    stories: {
      breathing: "122",
      oxygen: "0010000000022",
      walkingHr: "a0000011",
      sleep: "1012",
    },
    checkins: [{ requested: 3 }],
  },
  {
    id: "aisha",
    code: "SVH-3364",
    careEmail: "arrhythmia.nurses@stvincents.example",
    name: "Aisha Rahman",
    age: 52,
    profile: "afib",
    hospital: "St. Vincent's — Cardiology",
    clinician: "Dr. Nadia Foster",
    day: 21,
    stay: 2,
    stories: { restingHr: "a0200", hrv: "a00000100", avgHr: "300" },
    workouts: [2.4],
    checkins: [],
  },
  {
    id: "samuel",
    code: "MMC-6608",
    careEmail: "surgical.followup@mercymedical.example",
    name: "Samuel Osei",
    age: 63,
    profile: "abdominalSurgery",
    hospital: "Mercy Medical — General Surgery",
    clinician: "Dr. Sofia Marin",
    day: 19,
    stay: 5,
    stories: { restingHr: "1", hrv: "aaaba" },
    lead: { restingHr: true },
    checkins: [],
  },
  {
    id: "george",
    code: "TGH-9915",
    careEmail: "heart.failure.nurses@tampageneral.example",
    name: "George Whitfield",
    age: 80,
    profile: "heartFailure",
    hospital: "Tampa General — Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 27,
    stay: 7,
    stories: { restingHr: "a00000000a", hrv: "a0000000", sleep: "a00000a" },
    checkins: [],
  },
  {
    id: "lena",
    code: "BAY-4470",
    careEmail: "respiratory.team@bayfront.example",
    name: "Lena Fischer",
    age: 35,
    profile: "pneumonia",
    hospital: "Bayfront Health — Respiratory Unit",
    clinician: "Dr. Elena Ruiz",
    day: 3,
    stay: 4,
    missing: [1, 2],
    stories: { breathing: "1001", restingHr: "2001", skinTemp: "xxxx" },
    checkins: [],
  },
  {
    id: "marcus",
    name: "Marcus Webb",
    age: 58,
    profile: "sepsisWatch",
    hospital: "Tampa General — Colorectal Surgery",
    clinician: "Dr. Priya Raman",
    day: 6,
    stay: 3,
    stories: {
      restingHr: "12223",
      breathing: "1222",
      skinTemp: "0122",
      hrv: "1122",
      oxygen: "0",
      sleep: "1101",
    },
    checkins: [],
  },
  {
    id: "nadia",
    name: "Nadia Haq",
    age: 47,
    profile: "sepsisWatch",
    hospital: "Mercy Medical — General Surgery",
    clinician: "Dr. Sofia Marin",
    day: 12,
    stay: 2,
    stories: { restingHr: "0", breathing: "0", skinTemp: "0", hrv: "0" },
    checkins: [],
  },
  {
    id: "yusuf",
    name: "Yusuf Demir",
    age: 72,
    profile: "respiratoryInfection",
    hospital: "Lakeside Regional — Pulmonary",
    clinician: "Dr. James Cole",
    day: 4,
    stay: 2,
    stories: {
      breathing: "0122",
      skinTemp: "0123",
      hrv: "0112",
      restingHr: "0122",
      oxygen: "0011",
    },
    checkins: [],
  },
  {
    id: "ingrid",
    name: "Ingrid Larsen",
    age: 38,
    profile: "respiratoryInfection",
    hospital: "Bayfront Health — Respiratory Unit",
    clinician: "Dr. Elena Ruiz",
    day: 9,
    stay: 1,
    // The watch has not synced for three nights, so the engine reports that it
    // cannot see rather than reporting calm.
    missing: [7, 8, 9],
    stories: { breathing: "0", skinTemp: "0", hrv: "0", restingHr: "0" },
    checkins: [],
  },
  {
    id: "oliver",
    name: "Oliver Grant",
    age: 29,
    profile: "asthma",
    hospital: "Lakeside Regional — Pulmonary",
    clinician: "Dr. James Cole",
    day: 8,
    stay: 2,
    stories: {
      breathing: "1223",
      oxygen: "0122",
      sleep: "0112",
      walkingHr: "0011",
    },
    checkins: [],
  },
  {
    id: "beatrice",
    name: "Beatrice Cole",
    age: 64,
    profile: "asthma",
    hospital: "Bayfront Health — Respiratory Unit",
    clinician: "Dr. Elena Ruiz",
    day: 15,
    stay: 3,
    stories: { breathing: "0", oxygen: "0", sleep: "0", walkingHr: "0" },
    checkins: [],
  },
  {
    id: "hassan",
    name: "Hassan Ali",
    age: 55,
    profile: "pulmonaryEmbolism",
    hospital: "Tampa General — Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 5,
    stay: 6,
    stories: {
      breathing: "1222",
      restingHr: "1223",
      walkingHr: "0122",
      oxygen: "0011",
    },
    checkins: [],
  },
  {
    id: "clara",
    name: "Clara Moreau",
    age: 41,
    profile: "pulmonaryEmbolism",
    hospital: "Mercy Medical — General Medicine",
    clinician: "Dr. Sofia Marin",
    day: 19,
    stay: 5,
    stories: { breathing: "0", oxygen: "0", restingHr: "0", walkingHr: "0" },
    checkins: [],
  },
  {
    id: "arthur",
    name: "Arthur Bennett",
    age: 61,
    profile: "sleepApnoea",
    hospital: "Lakeside Regional — Sleep Medicine",
    clinician: "Dr. Hannah Iyer",
    day: 13,
    stay: 1,
    stories: {
      oxygen: "1223",
      deepSleep: "1122",
      sleep: "0011",
      restingHr: "0011",
    },
    checkins: [],
  },
  {
    id: "mei",
    name: "Mei Tanaka",
    age: 49,
    profile: "sleepApnoea",
    hospital: "Lakeside Regional — Sleep Medicine",
    clinician: "Dr. Hannah Iyer",
    day: 21,
    stay: 1,
    stories: { oxygen: "0", deepSleep: "0", sleep: "0", restingHr: "0" },
    checkins: [],
  },
  {
    id: "rosa",
    name: "Rosa Iglesias",
    age: 31,
    profile: "postpartum",
    hospital: "Tampa General — Maternity",
    clinician: "Dr. Naomi Adeyemi",
    day: 7,
    stay: 2,
    stories: {
      restingHr: "1223",
      skinTemp: "0122",
      breathing: "0112",
      sleep: "1122",
    },
    checkins: [],
  },
  {
    id: "amara",
    name: "Amara Nwosu",
    age: 27,
    profile: "postpartum",
    hospital: "Tampa General — Maternity",
    clinician: "Dr. Naomi Adeyemi",
    day: 16,
    stay: 2,
    stories: { restingHr: "0", skinTemp: "0", breathing: "0", sleep: "0" },
    checkins: [],
  },
];

// Patients defined without a discharge code get a stable one from their id, so
// every synthetic patient can sign in. Listed in docs/PATIENT.md.
function defaultCode(def) {
  let h = 0;
  for (const ch of def.id) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  const prefix =
    (def.hospital || "RLY")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "RLY";
  return `${prefix}-${String(1000 + h).padStart(4, "0")}`;
}

function seeded(seed) {
  let s = seed;
  return () =>
    ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * 2 - 1;
}
function spec(profile, signal) {
  return (
    PROFILES[profile].counted.find((c) => c.signal === signal) ||
    SIGNALS[signal]
  );
}
function valueFor(def, signal, ch, noise) {
  const [usual] = TYPICAL[signal];
  const { dir, thr } = spec(def.profile, signal);
  const step = thresholdOf(thr, usual);
  return usual + dir * step * (RATIO[ch] + noise * 0.07);
}
function storyFor(def, signal) {
  const tail = def.stories[signal] || "";
  // `lead` stories describe the first days at home; all others describe the most recent days.
  let story = def.lead?.[signal]
    ? tail.padEnd(def.day + 1, "0")
    : tail.padStart(def.day + 1, "0");
  for (const d of def.missing || [])
    story = story.slice(0, d) + "x" + story.slice(d + 1);
  return story;
}

function build(def, now, index) {
  const rand = seeded(index * 7919 + 17);
  const dischargedAt = now - (def.day * DAY + 15 * HOUR);
  const admittedAt = dischargedAt - def.stay * DAY;
  const profile = PROFILES[def.profile];
  const signals = [
    ...profile.counted.map((c) => c.signal),
    ...profile.recorded,
  ].filter((signal) => SIGNALS[signal].device !== "manual");
  const readings = {};
  signals.forEach((signal, k) => {
    const [usual, sd] = TYPICAL[signal];
    const list = [];
    for (let i = 0; i < 14; i++)
      list.push({
        t: admittedAt - (14 - i) * DAY + HOUR,
        v: usual + sd * 0.8 * Math.sin(i * 1.9 + k * 1.3 + index),
      });
    storyFor(def, signal)
      .split("")
      .forEach((ch, d) => {
        if (ch !== "x")
          list.push({
            t: dischargedAt + d * DAY + HOUR,
            v: valueFor(def, signal, ch, rand()),
          });
      });
    readings[signal] = list;
  });
  return {
    id: def.id,
    name: def.name,
    age: def.age,
    profile: def.profile,
    hospital: def.hospital,
    clinician: def.clinician,
    admittedAt,
    dischargedAt,
    readings,
    code: def.code || defaultCode(def),
    careEmail: def.careEmail || null,
    // Entered by the care team in the clinician view, never pre-written.
    notes: "",
    medications: [],
    appointments: [],
    messages: [],
    journal: [],
    reports: [],
    devices: {
      watch: {
        name: "Apple Watch",
        sharing: true,
        connected: true,
        lastSync: now - 12 * 60000,
      },
      whoop: {
        name: "WHOOP",
        sharing: true,
        connected:
          def.profile === "pneumonia" || def.profile === "abdominalSurgery",
        lastSync: now - 58 * 60000,
      },
      sensor: {
        name: "[Hardware sensor]",
        sharing: true,
        connected: true,
        lastSync: now,
        live: true,
      },
      phone: {
        name: "iPhone Health app",
        sharing: true,
        connected: false,
        lastSync: null,
        imports: 0,
      },
      manual: {
        name: "Your own entries",
        sharing: true,
        connected: true,
        lastSync: null,
      },
    },
    checkins: def.checkins.map((c) => ({
      requestedAt: now - c.requested * HOUR,
      answeredAt: c.answered ? now - c.answered * HOUR : null,
      answers: c.answers || {},
      note: c.note || null,
    })),
    workouts: (def.workouts || []).map((daysAgo) => ({
      t: now - daysAgo * DAY,
    })),
    acknowledgedAt: null,
  };
}

export function createSimulatedSource() {
  return {
    label: "Simulated stream",
    capabilities: { voice: false },
    connect(handlers) {
      const start = Date.now();
      handlers.snapshot(COHORT.map((def, i) => build(def, start, i)));
      const rand = seeded(99);
      const timer = setInterval(() => {
        const now = Date.now();
        const batch = [];
        for (const def of COHORT) {
          const profile = PROFILES[def.profile];
          for (const signal of [
            ...profile.counted.map((c) => c.signal),
            ...profile.recorded,
          ].filter((signal) => SIGNALS[signal].device !== "manual")) {
            const today = storyFor(def, signal)[def.day];
            const device = SIGNALS[signal].device;
            const connected =
              device !== "whoop" ||
              def.profile === "pneumonia" ||
              def.profile === "abdominalSurgery";
            if (today !== "x" && connected)
              batch.push({
                patientId: def.id,
                signal,
                t: now,
                v: valueFor(def, signal, today, rand()),
              });
          }
          handlers.device(def.id, "sensor", { lastSync: now });
          if (rand() > 0.86)
            handlers.device(def.id, "watch", { lastSync: now });
        }
        handlers.readings(batch);
      }, TICK_MS);
      // Never the reason a process stays alive (a no-op in browsers, where timers are numbers).
      timer.unref?.();
      return () => clearInterval(timer);
    },
  };
}

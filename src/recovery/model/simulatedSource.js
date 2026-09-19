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
  walkingSpeed: [1.07, 0.06],
  stepLength: [60, 2.5],
  asymmetry: [3.0, 0.8],
  doubleSupport: [29, 1.2],
  steadiness: [94, 1.5],
  steps: [6200, 900],
  temperature: [36.8, 0.15],
  weight: [78.0, 0.4],
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
    hospital: "Bayfront Health, Respiratory Unit",
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
    hospital: "Tampa General, Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 16,
    stay: 6,
    stories: {
      restingHr: "11223",
      hrv: "1122",
      breathing: "1123",
      walkingHr: "112",
      sleep: "11",
      weight: "11223",
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
    hospital: "Mercy Medical, General Surgery",
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
    hospital: "Lakeside Regional, Pulmonary",
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
    hospital: "St. Vincent's, Cardiology",
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
    hospital: "Mercy Medical, General Surgery",
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
    hospital: "Tampa General, Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 27,
    stay: 7,
    stories: {
      restingHr: "a00000000a",
      hrv: "a0000000",
      sleep: "a00000a",
      weight: "0",
    },
    checkins: [],
  },
  {
    id: "lena",
    code: "BAY-4470",
    careEmail: "respiratory.team@bayfront.example",
    name: "Lena Fischer",
    age: 35,
    profile: "pneumonia",
    hospital: "Bayfront Health, Respiratory Unit",
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
    code: "TGH-4417",
    profile: "sepsisWatch",
    hospital: "Tampa General, Acute Medicine",
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
    checkins: [{ requested: 5 }],
  },
  {
    id: "nadia",
    name: "Nadia Haq",
    age: 47,
    code: "MMC-2856",
    profile: "sepsisWatch",
    hospital: "Mercy Medical, Acute Medicine",
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
    code: "LKR-3092",
    profile: "respiratoryInfection",
    hospital: "Lakeside Regional, Pulmonary",
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
    checkins: [{ requested: 3 }],
  },
  {
    id: "ingrid",
    name: "Ingrid Larsen",
    age: 38,
    code: "BAY-6174",
    profile: "respiratoryInfection",
    hospital: "Bayfront Health, Respiratory Unit",
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
    code: "LKR-5238",
    profile: "asthma",
    hospital: "Lakeside Regional, Pulmonary",
    clinician: "Dr. James Cole",
    day: 8,
    stay: 2,
    stories: {
      breathing: "1223",
      oxygen: "0122",
      sleep: "0112",
      walkingHr: "0011",
    },
    checkins: [{ requested: 9 }],
  },
  {
    id: "beatrice",
    name: "Beatrice Cole",
    age: 64,
    code: "BAY-8461",
    profile: "asthma",
    hospital: "Bayfront Health, Respiratory Unit",
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
    code: "TGH-7305",
    profile: "pulmonaryEmbolism",
    hospital: "Tampa General, Cardiology",
    clinician: "Dr. Marcus Bell",
    day: 5,
    stay: 6,
    stories: {
      breathing: "1222",
      restingHr: "1223",
      walkingHr: "0122",
      oxygen: "0011",
    },
    checkins: [{ requested: 2 }],
  },
  {
    id: "clara",
    name: "Clara Moreau",
    age: 41,
    code: "MMC-4920",
    profile: "pulmonaryEmbolism",
    hospital: "Mercy Medical, General Medicine",
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
    code: "LKR-1587",
    profile: "sleepApnoea",
    hospital: "Lakeside Regional, Sleep Medicine",
    clinician: "Dr. Hannah Iyer",
    day: 13,
    stay: 1,
    stories: {
      oxygen: "1223",
      deepSleep: "1122",
      sleep: "0011",
      restingHr: "0011",
    },
    checkins: [{ requested: 14 }],
  },
  {
    id: "mei",
    name: "Mei Tanaka",
    age: 49,
    code: "LKR-9643",
    profile: "sleepApnoea",
    hospital: "Lakeside Regional, Sleep Medicine",
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
    code: "TGH-2079",
    profile: "postpartum",
    hospital: "Tampa General, Maternity",
    clinician: "Dr. Naomi Adeyemi",
    day: 7,
    stay: 2,
    stories: {
      restingHr: "1223",
      skinTemp: "0122",
      breathing: "0112",
      sleep: "1122",
    },
    checkins: [{ requested: 6 }],
  },
  {
    id: "amara",
    name: "Amara Nwosu",
    age: 27,
    code: "TGH-6812",
    profile: "postpartum",
    hospital: "Tampa General, Maternity",
    clinician: "Dr. Naomi Adeyemi",
    day: 16,
    stay: 2,
    stories: { restingHr: "0", skinTemp: "0", breathing: "0", sleep: "0" },
    checkins: [],
  },
  {
    id: "elena",
    name: "Elena Voss",
    age: 69,
    code: "TGH-3348",
    profile: "jointReplacement",
    hospital: "Tampa General, Orthopaedics",
    clinician: "Dr. Samuel Okonkwo",
    day: 10,
    stay: 2,
    stories: {
      walkingSpeed: "0000011223",
      stepLength: "000001122",
      doubleSupport: "00000112",
      steps: "0000011223",
      asymmetry: "00000011",
      restingHr: "0",
    },
    checkins: [{ requested: 11 }],
  },
  {
    id: "raymond",
    name: "Raymond Chu",
    age: 74,
    code: "TGH-9126",
    profile: "jointReplacement",
    hospital: "Tampa General, Orthopaedics",
    clinician: "Dr. Samuel Okonkwo",
    day: 18,
    stay: 3,
    stories: {
      walkingSpeed: "0",
      stepLength: "0",
      doubleSupport: "0",
      steps: "0",
    },
    checkins: [],
  },
  {
    id: "nathan",
    name: "Nathan Boateng",
    age: 71,
    code: "TGH-5164",
    profile: "strokeRehabilitation",
    hospital: "Tampa General, Neurology",
    clinician: "Dr. Priya Raman",
    day: 12,
    stay: 7,
    // Walking slows and shortens while asymmetry and double support rise
    // together: the gait pattern physiotherapy would want to look at. It says
    // nothing about a new stroke, and the program note says so too.
    stories: {
      walkingSpeed: "000000011223",
      stepLength: "00000001122",
      asymmetry: "0000000112",
      doubleSupport: "000000011223",
      steps: "00000001122",
      steadiness: "000000011",
      restingHr: "0",
    },
    checkins: [{ requested: 4 }],
  },
  {
    id: "dorothy",
    name: "Dorothy Kimani",
    age: 66,
    code: "TGH-8390",
    profile: "strokeRehabilitation",
    hospital: "Tampa General, Neurology",
    clinician: "Dr. Priya Raman",
    day: 19,
    stay: 5,
    stories: {
      walkingSpeed: "0",
      stepLength: "0",
      asymmetry: "0",
      doubleSupport: "0",
      steps: "0",
      steadiness: "0",
    },
    checkins: [],
  },
  {
    id: "felix",
    name: "Felix Moreno",
    age: 63,
    code: "SVH-7742",
    profile: "cardiacRecovery",
    hospital: "St. Vincent's, Cardiology",
    clinician: "Dr. Hannah Weiss",
    day: 9,
    stay: 4,
    // Resting heart rate up while variability, sleep and steps fall away: the
    // shape a cardiac rehab nurse asks about after a stent.
    stories: {
      restingHr: "000011223",
      hrv: "00001122",
      sleep: "0000112",
      steps: "000011223",
      weight: "0",
    },
    checkins: [{ requested: 20 }],
  },
  {
    id: "ruth",
    name: "Ruth Delacroix",
    age: 58,
    code: "SVH-2915",
    profile: "cardiacRecovery",
    hospital: "St. Vincent's, Cardiology",
    clinician: "Dr. Hannah Weiss",
    day: 22,
    stay: 6,
    stories: { restingHr: "0", hrv: "0", sleep: "0", steps: "0", weight: "0" },
    checkins: [],
  },
  {
    id: "grace",
    name: "Grace Adebayo",
    age: 56,
    code: "MOF-2201",
    profile: "postChemotherapy",
    hospital: "Moffitt, Malignant Hematology",
    clinician: "Dr. Leila Haddad",
    day: 8,
    stay: 4,
    stories: {
      // Temperature is manual entry and is not synthesised, so the sensor
      // signals carry the pattern: the resting-HR rise with HRV and breathing
      // moving together that precedes febrile neutropenia.
      temperature: "000001223",
      restingHr: "00000122",
      hrv: "0000122",
      breathing: "0000122",
      oxygen: "0",
    },
    checkins: [{ requested: 8 }],
  },
  {
    id: "victor",
    name: "Victor Lindqvist",
    age: 62,
    code: "MOF-7735",
    profile: "postChemotherapy",
    hospital: "Moffitt, Malignant Hematology",
    clinician: "Dr. Leila Haddad",
    day: 15,
    stay: 3,
    stories: { temperature: "0", restingHr: "0", hrv: "0", breathing: "0" },
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

// What the hospital wrote at discharge, per pathway, so the demo opens on a
// patient who has been home for days with a real discharge behind them. Notes,
// prescriptions and the follow-up are illustrative, not clinical advice. The
// care team can still overwrite them from the clinician view.
const DISCHARGE = {
  pneumonia: {
    notes:
      "Community-acquired pneumonia, right lower lobe, treated with IV then oral antibiotics. Oxygen saturation 96% on room air at discharge. Finish the antibiotic course, rest, and keep fluids up. Breathing should ease day by day; contact the respiratory team if breathlessness, fever or cough gets worse rather than better.",
    medications: [
      "Amoxicillin 500 mg, three times a day, 5 more days",
      "Paracetamol 1 g, up to four times a day, as needed",
    ],
    followUpDay: 14,
    where: "Respiratory clinic, outpatients level 2",
  },
  heartFailure: {
    notes:
      "Admitted with fluid overload from heart failure; diuretics adjusted and weight down 3.2 kg by discharge. Weigh yourself every morning after the toilet, before breakfast. Keep to the fluid and salt limits discussed. Report a weight gain of 2 kg in three days, more swelling, or waking breathless.",
    medications: [
      "Furosemide 40 mg, every morning",
      "Bisoprolol 2.5 mg, once a day",
      "Ramipril 5 mg, once a day",
    ],
    followUpDay: 10,
    where: "Heart failure nurse clinic",
  },
  abdominalSurgery: {
    notes:
      "Laparoscopic cholecystectomy, uncomplicated. Wound dressings can come off on day 5; keep the sites clean and dry. Walk a little more each day; no lifting over 5 kg for four weeks. Contact the surgical team for fever, spreading redness at a wound, or pain that is getting worse instead of better.",
    medications: [
      "Ibuprofen 400 mg, three times a day with food, 5 days",
      "Paracetamol 1 g, up to four times a day, as needed",
    ],
    followUpDay: 14,
    where: "Surgical review clinic",
  },
  copd: {
    notes:
      "COPD exacerbation treated with steroids and antibiotics; back to baseline breathing on discharge. Continue inhalers as prescribed and use the rescue inhaler as agreed in your action plan. Contact the pulmonary team if you need the rescue inhaler more than four times a day or your mucus changes colour.",
    medications: [
      "Prednisolone 30 mg, once a day, 3 more days",
      "Tiotropium inhaler, once a day",
      "Salbutamol inhaler, as needed",
    ],
    followUpDay: 12,
    where: "Pulmonary clinic",
  },
  afib: {
    notes:
      "Atrial fibrillation with fast rate, now rate-controlled. Anticoagulation started; do not miss doses. Avoid alcohol and heavy caffeine for now. Contact the arrhythmia nurses for a racing or irregular heartbeat lasting more than an hour, dizziness, or any bleeding.",
    medications: ["Apixaban 5 mg, twice a day", "Bisoprolol 5 mg, once a day"],
    followUpDay: 21,
    where: "Arrhythmia clinic",
  },
  sepsisWatch: {
    notes:
      "Treated for a urinary infection with a blood-stream infection; completed IV antibiotics and switched to tablets. Temperature normal for 48 hours before discharge. Finish the tablets and drink well. Contact the team for a temperature over 38 °C, shivering, confusion, or feeling much worse.",
    medications: ["Ciprofloxacin 500 mg, twice a day, 7 more days"],
    followUpDay: 7,
    where: "Acute medicine review clinic",
  },
  respiratoryInfection: {
    notes:
      "Lower respiratory tract infection, treated with antibiotics. Cough may take two to three weeks to settle. Contact the team if breathing gets harder, fever returns, or you cough up blood.",
    medications: ["Doxycycline 100 mg, once a day, 4 more days"],
    followUpDay: 14,
    where: "Respiratory clinic",
  },
  asthma: {
    notes:
      "Asthma attack treated with nebulisers and steroids; peak flow back to 80% of your best. Keep the preventer inhaler going every day even when well. Follow your asthma action plan; contact the team if the reliever is needed more often than every four hours.",
    medications: [
      "Prednisolone 40 mg, once a day, 2 more days",
      "Beclometasone inhaler, twice a day",
      "Salbutamol inhaler, as needed",
    ],
    followUpDay: 10,
    where: "Asthma nurse clinic",
  },
  pulmonaryEmbolism: {
    notes:
      "Pulmonary embolism confirmed on CT, started on anticoagulation. Do not miss doses. Walking is encouraged; avoid long periods sitting still. Contact the team for new chest pain, breathlessness getting worse, coughing blood, or any unusual bleeding.",
    medications: ["Rivaroxaban 15 mg, twice a day with food, 3 weeks"],
    followUpDay: 21,
    where: "Anticoagulation clinic",
  },
  sleepApnoea: {
    notes:
      "Obstructive sleep apnoea confirmed; CPAP fitted and settings adjusted. Use it every night for the whole night. Contact the sleep service if the mask leaks, you wake unrefreshed, or daytime sleepiness returns.",
    medications: [],
    followUpDay: 28,
    where: "Sleep service",
  },
  postpartum: {
    notes:
      "Delivery by caesarean section; recovering well. Keep the wound clean and dry. Rest and accept help. Contact the maternity team for heavy bleeding, fever, a painful red wound, headache with vision changes, or calf pain.",
    medications: [
      "Paracetamol 1 g, up to four times a day, as needed",
      "Ibuprofen 400 mg, three times a day with food, as needed",
    ],
    followUpDay: 10,
    where: "Postnatal clinic",
  },
  jointReplacement: {
    notes:
      "Total knee replacement, left. Physiotherapy exercises three times a day as shown. Walk with the frame, then sticks, as the physio advises. Contact the orthopaedic team for a hot, swollen or oozing wound, calf pain, or a fall.",
    medications: [
      "Paracetamol 1 g, four times a day",
      "Codeine 30 mg, up to four times a day, as needed",
      "Enoxaparin injection, once a day, 14 days",
    ],
    followUpDay: 14,
    where: "Orthopaedic clinic",
  },
  postChemotherapy: {
    notes:
      "Discharged after cycle 3 of chemotherapy. Blood counts will be lowest around days 7 to 12; avoid crowds and anyone unwell. Check your temperature twice a day. A temperature of 38 °C or above is an emergency: call the oncology hotline at once.",
    medications: [
      "Ondansetron 8 mg, twice a day, 3 days",
      "Dexamethasone 4 mg, twice a day, 2 days",
    ],
    followUpDay: 21,
    where: "Oncology day unit",
  },
};

function build(def, now, index) {
  const rand = seeded(index * 7919 + 17);
  // Every patient was discharged at exactly the same time of day, so every
  // patient's change had persisted for exactly 38 hours, and the watchlist
  // printed "for 38 hours" fourteen times in a column. Spreading the discharge
  // hour is the whole fix: the readings still land once a day, the run lengths
  // still come from the story, but two patients no longer agree to the hour.
  const dischargeHour = 12 + (index % 8);
  const dischargedAt = now - (def.day * DAY + dischargeHour * HOUR);
  const admittedAt = dischargedAt - def.stay * DAY;
  const profile = PROFILES[def.profile];
  const discharge = DISCHARGE[def.profile] || null;
  // A watch cannot take a weight or a temperature: those exist only because the
  // patient wrote them down. So a manual signal is simulated for a patient the
  // scenario says records it, and for nobody else. It is built into the history
  // but never streamed on the tick below, because a morning weight arrives once
  // a day, not every few seconds.
  // A device this program reads from is a device this patient has connected.
  // Hardcoding it the other way put "iPhone Health app is not connected" on the
  // same screen as five counted gait signals streaming from the phone, and said
  // WHOOP was absent while skin temperature from it drove the review.
  const uses = (device) =>
    [...profile.counted.map((c) => c.signal), ...profile.recorded].some(
      (signal) => SIGNALS[signal].device === device,
    );
  const signals = [
    ...profile.counted.map((c) => c.signal),
    ...profile.recorded,
  ].filter(
    (signal) => SIGNALS[signal].device !== "manual" || def.stories[signal],
  );
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
    // The discharge the hospital wrote. Messages, journal entries and reports
    // are not pre-written: they happen during the demo.
    notes: discharge?.notes || "",
    medications: discharge?.medications || [],
    appointments: discharge
      ? [
          {
            t: dischargedAt + discharge.followUpDay * DAY - 5 * HOUR,
            with: def.clinician,
            where: `${discharge.where}, ${def.hospital}`,
          },
        ]
      : [],
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
        connected: uses("whoop"),
        lastSync: now - 58 * 60000,
      },
      phone: {
        name: "iPhone Health app",
        sharing: true,
        connected: uses("phone"),
        lastSync: uses("phone") ? now - 26 * 60000 : null,
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

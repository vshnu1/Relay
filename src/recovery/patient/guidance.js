// "For today": what a patient can do about the readings they already have.
// Pure functions over the derived view (derive.js): no clock of their own, no
// fetch, no model call. Every sentence is a template over the patient's own
// value, their usual, how long a change has lasted, which device saw it, and
// what is on their discharge record (medicines, devices, schedule).
//
// When a reading is unusual the card is a short list of small, safe things that
// can help a little and cannot make it worse: rest, posture, no stimulants,
// medicines exactly as prescribed, a regular bedtime. It never diagnoses, never
// calls a reading clinically "high" or "low", never promises improvement, and
// never speaks about a measurement the record does not hold. The check-in
// itself belongs to the alert banner above the card, so the Home card never
// carries a second check-in button.
import { SIGNALS } from "../model/profiles.js";
import { checkinDue, nextScheduledDay } from "../model/schedule.js";
import { list, numberWord } from "../format.js";

export const CHECKIN_HREF = "#/patient/checkin";
export const CONNECT_HREF = "#/patient/connect";
export const READINGS_HREF = "#/patient/readings";
export const readingHref = (id) => `${READINGS_HREF}/${id}`;

// Signal families, by what a patient can safely do about a change in them.
const FAMILY = {
  breathing: "vitals",
  oxygen: "vitals",
  restingHr: "vitals",
  skinTemp: "vitals",
  hrv: "vitals",
  walkingHr: "vitals",
  avgHr: "vitals",
  temperature: "vitals",
  steps: "activity",
  walkingSpeed: "activity",
  stepLength: "gait",
  asymmetry: "gait",
  doubleSupport: "gait",
  steadiness: "gait",
  sleep: "sleep",
  deepSleep: "sleep",
  pain: "pain",
  weight: "weight",
};
export const familyOf = (id) => FAMILY[id] || null;

const HOME_TIPS = 6;
const METRIC_TIPS = 3;

// A reading can only be compared once the patient has a usual.
const comparable = (s) => !!s && s.usual !== null && s.usual !== undefined;
// The same definition the tiles use for their "Unusual" chip.
const unusual = (s) => !!(s.moved || s.towardDays > 0);
const deviceOf = (s) => SIGNALS[s.id]?.device || s.device;
const cap = (text) => text[0].toUpperCase() + text.slice(1);
// Moved first, then the furthest from usual.
const bySeverity = (a, b) =>
  Number(b.moved) - Number(a.moved) ||
  Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0) ||
  (b.towardDays || 0) - (a.towardDays || 0);

function deviceName(p, s) {
  const device = deviceOf(s);
  const name = p.devices?.[device]?.name;
  if (name && device !== "manual") return name;
  return { watch: "watch", whoop: "WHOOP", phone: "phone" }[device] || null;
}

// "16.5 against 14.2 per min", "94.5% against 96.8%", "6 against 3 out of 10".
function values(s) {
  const a = s.fmt(s.today);
  const b = s.fmt(s.usual);
  if (s.unit === "%") return `${a}% against ${b}%`;
  if (s.unit === "/10") return `${a} against ${b} out of 10`;
  return `${a} against ${b} ${s.unit}`;
}

function directionWord(s) {
  if (s.id === "pain") return s.watchDir > 0 ? "higher" : "lower";
  return (s.watchDir > 0 ? s.up : s.down).toLowerCase();
}

// "since day 9", "for one night", "for three days".
function spanText(s) {
  if (s.moved && s.runStart !== null && s.runStart !== undefined)
    return `since day ${s.runStart + 1}`;
  const one = s.span === "nights" ? "night" : "day";
  return s.towardDays === 1
    ? `for one ${one}`
    : `for ${numberWord(s.towardDays)} ${s.span}`;
}

// "Your breathing while asleep has been faster than your usual since day 9
// (16.5 against 14.2 per min)". Names that already say "you" keep their shape:
// "How fast you walk has been slower than your usual…".
function subject(s) {
  const plain = s.plain || s.short || s.id;
  return /\b(you|your)\b/i.test(plain)
    ? cap(plain)
    : `Your ${plain.toLowerCase()}`;
}
export function observation(s) {
  const verb = s.id === "steps" ? "have been" : "has been";
  return `${subject(s)} ${verb} ${directionWord(s)} than your usual ${spanText(s)} (${values(s)})`;
}

// "Based on breathing rate from your Apple Watch, compared with your usual."
function evidenceFor(p, signals) {
  const manual = signals.filter((s) => deviceOf(s) === "manual");
  const worn = signals.filter((s) => deviceOf(s) !== "manual");
  const parts = [];
  if (worn.length === 1)
    parts.push(`${worn[0].short} from your ${deviceName(p, worn[0])}`);
  else if (worn.length > 1) {
    const names = [
      ...new Set(worn.map((s) => deviceName(p, s)).filter(Boolean)),
    ];
    parts.push(`readings from your ${list(names)}`);
  }
  if (manual.length)
    parts.push(
      `the ${list(manual.map((s) => s.short))} you entered${worn.length ? " yourself" : ""}`,
    );
  return `Based on ${parts.join(" and ")}, compared with your usual before your stay.`;
}

// ---- Tips: small, safe, and grounded in the record --------------------------

const tip = (text, href, label) => (href ? { text, href, label } : { text });
const TIP = {
  rest: "Take it easy today: rest more than usual and avoid heavy effort.",
  upright:
    "Sit upright rather than lying flat, and take slow, steady breaths when you rest.",
  stimulants: "Skip caffeine and alcohol today, and rest between activities.",
  cool: "Dress lightly and keep the room cool. Drink regularly, unless your care team has told you to limit fluids.",
  sleep: "Keep a regular bedtime tonight and avoid caffeine late in the day.",
  activityGo:
    "If your discharge plan allows activity, take one short walk or do your prescribed exercises. Stop and rest if you feel worse.",
  activityHold:
    "Keep activity light today. A longer walk can wait until your readings settle.",
  gait: "Take your time standing up or turning, and keep to the exercises in your discharge plan.",
  painPlan: "Take your pain relief as prescribed, and nothing extra.",
  painWorse:
    "If the pain is getting worse rather than better, tell your care team at your check-in.",
  weighAgain: "Weigh again tomorrow: same scale, same time, before breakfast.",
  fluidSalt:
    "Keep to any fluid or salt instructions your care team has given you.",
};

// "Amoxicillin 500 mg, three times a day, 5 more days" -> "Amoxicillin 500 mg".
const medicineNames = (p) =>
  (p.medications || [])
    .map((m) => String(m).split(",")[0].trim())
    .filter(Boolean);

// Only when the record lists medicines; nothing is invented for a patient
// discharged without any.
function medicineTip(p, routine) {
  const names = medicineNames(p);
  if (!names.length) return null;
  return tip(
    routine
      ? `Take your medicines as listed: ${list(names)}.`
      : `Take your medicines exactly as prescribed, and nothing extra: ${list(names)}.`,
  );
}

// A warmer wrist is a reason to take a real temperature, when this pathway
// records one and none was entered today.
function temperatureTip(p) {
  const t = (p.signals || []).find((s) => s.id === "temperature");
  if (!t || (t.today !== null && t.today !== undefined)) return null;
  return tip(
    "Check your temperature with your own thermometer and add it in Readings.",
    readingHref("temperature"),
    "Add temperature",
  );
}

// What a patient can do about one unusual reading.
function tipsFor(s, p, vitalsAway) {
  switch (familyOf(s.id)) {
    case "vitals":
      if (s.id === "breathing" || s.id === "oxygen") return [tip(TIP.upright)];
      // A warmer wrist: take a real temperature if one can be entered and
      // none was today; otherwise the things that keep a temperature down.
      if (s.id === "skinTemp") return [temperatureTip(p) || tip(TIP.cool)];
      if (s.id === "temperature") return [tip(TIP.cool)];
      return [tip(TIP.stimulants)];
    case "activity":
      return [tip(vitalsAway ? TIP.activityHold : TIP.activityGo)];
    case "gait":
      return [tip(TIP.gait)];
    case "sleep":
      return [tip(TIP.sleep)];
    case "pain":
      return [tip(TIP.painPlan), tip(TIP.painWorse)];
    case "weight":
      return [tip(TIP.weighAgain), tip(TIP.fluidSalt)];
    default:
      return [];
  }
}

// A reading that did not arrive, as one line with the way to fix it.
function missingTip(p, s) {
  const device = deviceOf(s);
  const name = deviceName(p, s);
  if (device === "manual")
    return tip(
      `Add today's ${s.short} in Readings.`,
      readingHref(s.id),
      "Add a reading",
    );
  if (p.devices?.[device]?.connected === false)
    return tip(
      `Reconnect your ${name}; no ${s.short} readings are arriving.`,
      CONNECT_HREF,
      "Your data",
    );
  if (device === "phone")
    return tip(
      `Carry your phone with you today; no ${s.short} reading arrived.`,
      CONNECT_HREF,
      "Your data",
    );
  return tip(
    `Wear your ${name} tonight; no ${s.short} reading arrived last night.`,
    CONNECT_HREF,
    "Your data",
  );
}

const dedupe = (tips, max) => {
  const seen = new Set();
  return tips
    .filter((t) => t && !seen.has(t.text) && seen.add(t.text))
    .slice(0, max);
};

// ---- Cards -------------------------------------------------------------------

// Nights where most counted readings are missing, out of the last four.
function nightsMissing(p) {
  const counted = p.counted || [];
  if (!counted.length) return 0;
  const days = [...Array((p.dayHome ?? 0) + 1).keys()].slice(-4);
  return days.filter(
    (d) =>
      counted.filter((s) => (s.home?.[d]?.v ?? null) === null).length >
      counted.length / 2,
  ).length;
}

// Most readings did not arrive: the device is the step, never the reading.
function missingGuidance(p, missing) {
  const byDevice = Object.groupBy(missing, deviceOf);
  const device = Object.keys(byDevice).sort(
    (a, b) => byDevice[b].length - byDevice[a].length,
  )[0];
  const signals = byDevice[device];
  const shorts = list(signals.map((s) => s.short));
  const name = deviceName(p, signals[0]);
  const nights = nightsMissing(p);
  const base = {
    id: "missing",
    tone: "action",
    signals: signals.map((s) => s.id),
    evidence: `Based on which readings arrived from your ${device === "manual" ? "own entries" : name}, not on a change in them.`,
  };
  if (device === "manual")
    return {
      ...base,
      icon: "entry",
      title: `Add today's ${signals[0].short}`,
      lead: `There is no ${shorts} entry for today, so there is nothing to compare with your usual.`,
      tips: [tip("Enter it the same way you usually do, at the usual time.")],
      cta: { label: "Add a reading", href: readingHref(signals[0].id) },
    };
  if (p.devices?.[device]?.connected === false)
    return {
      ...base,
      icon: device === "phone" ? "phone" : "watch",
      title: `Reconnect your ${name}`,
      lead: `Your ${name} is not connected, so no ${shorts} readings are arriving.`,
      tips: [tip("Reconnect it in Your data so your care team can see them.")],
      cta: { label: "Your data", href: CONNECT_HREF },
    };
  if (device === "phone")
    return {
      ...base,
      icon: "phone",
      title: "Carry your phone with you today",
      lead: `There is no ${shorts} reading for today, so there is nothing to compare with your usual.`,
      tips: [
        tip("The phone in your pocket measures it as you walk."),
        tip("Check the Health app is still connected in Your data."),
      ],
      cta: { label: "Your data", href: CONNECT_HREF },
    };
  const lead =
    nights > 1
      ? `Readings are missing for ${numberWord(nights)} of the last four nights, so there is little to compare with your usual.`
      : signals.every((s) => s.today === null || s.today === undefined)
        ? `There is no ${shorts} reading for last night, so there is nothing to compare with your usual.`
        : "Too few readings have arrived to compare with your usual.";
  return {
    ...base,
    icon: "watch",
    title: `Wear your ${name} tonight`,
    lead,
    tips: [
      tip("Charge it before bed and keep it on your wrist through the night."),
      tip("Check it is still connected in Your data."),
    ],
    cta: { label: "Your data", href: CONNECT_HREF },
  };
}

// Something is unusual: the observation, then the list of what can help.
function actGuidance(p, changed, missing, { home }) {
  const sorted = [...changed].sort(bySeverity);
  const lead = sorted[0];
  const vitalsMoved = sorted.some(
    (s) => familyOf(s.id) === "vitals" && s.moved,
  );
  // "Four other readings have moved with it, for about 35 hours, and three
  // more are a little away from your usual."
  const rest = sorted.slice(1);
  const movedOthers = rest.filter((s) => s.moved).length;
  const mildOthers = rest.length - movedOthers;
  const span = p.hours ? `, for about ${p.hours} hours` : "";
  let tail = "";
  if (movedOthers)
    tail += ` ${numberWord(movedOthers, true)} other ${movedOthers === 1 ? "reading has" : "readings have"} moved with it${span}`;
  if (mildOthers)
    tail += movedOthers
      ? `, and ${numberWord(mildOthers)} more ${mildOthers === 1 ? "is" : "are"} a little away from your usual.`
      : ` ${numberWord(mildOthers, true)} other ${mildOthers === 1 ? "reading is" : "readings are"} a little away from your usual too.`;
  else if (movedOthers) tail += ".";
  const observed = `${observation(lead)}${lead.moved ? "" : ", but not by much"}.${tail}`;
  const away = vitalsAway(p);
  const tips = dedupe(
    [
      vitalsMoved ? tip(TIP.rest) : null,
      home ? medicineTip(p, false) : null,
      ...sorted.flatMap((s) => tipsFor(s, p, away)),
      ...missing.map((s) => missingTip(p, s)),
    ],
    home ? HOME_TIPS : METRIC_TIPS,
  );
  return {
    id: "act",
    tone: vitalsMoved ? "attention" : "action",
    icon: "plan",
    title: "What you can do today",
    lead: observed,
    tips,
    evidence: evidenceFor(p, sorted),
    cta: null,
    signals: sorted.map((s) => s.id),
  };
}

// Everything about usual: the plan, as the things on the record to keep doing.
function usualGuidance(p, signals, missing, now) {
  const n = signals.length;
  const worn = [
    ...new Set(
      signals
        .filter((s) => ["watch", "whoop"].includes(deviceOf(s)))
        .map((s) => deviceName(p, s))
        .filter(Boolean),
    ),
  ];
  const due = checkinDue(p, now);
  const next = nextScheduledDay(p.dayHome ?? 0);
  const tips = dedupe(
    [
      medicineTip(p, true),
      ...missing.map((s) => missingTip(p, s)),
      worn.length
        ? tip(
            `Wear your ${list(worn)} tonight so tomorrow's readings can be compared.`,
          )
        : null,
      !due.due && next ? tip(`Your next check-in is on day ${next}.`) : null,
    ],
    4,
  );
  return {
    id: "usual",
    tone: "calm",
    icon: "usual",
    title: "Keep to your discharge plan and your routine today",
    lead: `${n === 1 ? "The reading" : `All ${numberWord(n)} readings`} watched after ${p.profile?.after || "your stay"} ${n === 1 ? "is" : "are"} about your usual. Nothing to change today.`,
    tips,
    evidence: evidenceFor(p, signals),
    cta: null,
    signals: signals.map((s) => s.id),
  };
}

const vitalsAway = (p) =>
  (p.signals || []).some(
    (s) => comparable(s) && familyOf(s.id) === "vitals" && unusual(s),
  );

// Guidance for one reading, shown under its chart. Null when there is nothing
// to compare: no usual yet, or a signal this pathway does not track. This page
// has no alert banner, so a moved vital may carry the check-in link here.
export function metricGuidance(s, p, now = Date.now()) {
  if (!comparable(s) || !familyOf(s.id)) return null;
  if (s.today === null || s.today === undefined) return missingGuidance(p, [s]);
  if (!unusual(s))
    return {
      id: "usual",
      tone: "calm",
      icon: "usual",
      title: "Nothing to change today",
      lead: `${subject(s)} is about your usual (${values(s)}). Keep to your discharge plan and your routine.`,
      tips: [],
      evidence: evidenceFor(p, [s]),
      cta: null,
      signals: [s.id],
    };
  const g = actGuidance({ ...p, hours: 0 }, [s], [], { home: false });
  // Only the readings that ask for a check-in on this pathway link to one.
  if (familyOf(s.id) === "vitals" && s.moved) {
    const due = checkinDue(p, now);
    g.cta = due.due
      ? { label: "Check in", href: CHECKIN_HREF, primary: true }
      : { label: "Check in again", href: CHECKIN_HREF };
  } else if (s.id === "pain" && s.moved)
    g.cta = { label: "Check in", href: CHECKIN_HREF, primary: true };
  return g;
}

// The one card for Home. At most one, so the screen stays calm, and never a
// check-in button: the alert banner above it owns the check-in.
export function homeGuidance(p, now = Date.now()) {
  const signals = (p.signals || []).filter(
    (s) => comparable(s) && familyOf(s.id),
  );
  const counted = signals.filter((s) => s.counted);
  const missing = counted.filter(
    (s) => s.today === null || s.today === undefined,
  );
  const withLink = (g) =>
    g && {
      ...g,
      cta:
        g.cta ||
        (g.signals.length === 1
          ? { label: "See this reading", href: readingHref(g.signals[0]) }
          : { label: "See your readings", href: READINGS_HREF }),
    };

  // 1. Most readings did not arrive: the device is the step.
  const mostMissing =
    missing.length > 0 && missing.length * 2 >= counted.length;
  if (p.status === "nodata" || mostMissing) {
    const worn = counted.filter((s) => deviceOf(s) !== "manual");
    const pool = mostMissing ? missing : worn.length ? worn : missing;
    if (pool.length) return withLink(missingGuidance(p, pool));
  }
  // 2. Something is unusual: what can help, and cannot make it worse.
  const changed = signals.filter(unusual);
  if (changed.length)
    return withLink(actGuidance(p, changed, missing, { home: true }));
  // 3. Everything usual: keep doing what the record says.
  const shown = counted.length ? counted : signals;
  if (shown.length) return withLink(usualGuidance(p, shown, missing, now));
  return null;
}

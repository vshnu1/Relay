// "For today": one clear, safe next step from the readings the patient already
// has. Pure functions over the derived view (derive.js): no clock of their own,
// no fetch, no model call. Every sentence is a template over the patient's own
// value, their usual, how long a change has lasted, and which device saw it.
//
// What it never does: diagnose, call a reading clinically "high" or "low",
// promise that something will improve, prescribe treatment, or speak about a
// measurement the record does not hold. A signal with no usual to compare
// against, or one this pathway does not track, produces no guidance at all.
import { SIGNALS } from "../model/profiles.js";
import { checkinDue, readingsAsk } from "../model/schedule.js";
import { ago, list, numberWord } from "../format.js";

export const CHECKIN_HREF = "#/patient/checkin";
export const CONNECT_HREF = "#/patient/connect";
export const READINGS_HREF = "#/patient/readings";
export const readingHref = (id) => `${READINGS_HREF}/${id}`;

// Signal families, by what a patient can safely do about a change in them.
// Vitals only ever lead to a check-in or to the discharge instructions.
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
// When more than one reading asks for something, the first family here wins.
const FAMILY_RANK = ["pain", "weight", "gait", "activity", "sleep"];

export const familyOf = (id) => FAMILY[id] || null;

// A reading can only be compared once the patient has a usual.
const comparable = (s) => !!s && s.usual !== null && s.usual !== undefined;
// The same definition the tiles use for their "Unusual" chip.
const unusual = (s) => !!(s.moved || s.towardDays > 0);

const cap = (text) => text[0].toUpperCase() + text.slice(1);

function deviceName(p, s) {
  const device = SIGNALS[s.id]?.device || s.device;
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
  const manual = signals.filter(
    (s) => (SIGNALS[s.id]?.device || s.device) === "manual",
  );
  const worn = signals.filter(
    (s) => (SIGNALS[s.id]?.device || s.device) !== "manual",
  );
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

const checkin = (label = "Check in") => ({ label, href: CHECKIN_HREF });

// Readings that stayed away from usual: the step is the check-in, or the
// discharge instructions if the check-in is already with the care team.
function checkinGuidance(p, moved, due, now) {
  const lead = [...moved].sort(
    (a, b) =>
      Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0) ||
      (b.towardDays || 0) - (a.towardDays || 0),
  )[0];
  const span = p.hours ? `, for about ${p.hours} hours` : "";
  const others = moved.length - 1;
  const what = lead
    ? `${observation(lead)}.${
        others > 0
          ? ` ${numberWord(others, true)} other ${others === 1 ? "reading has" : "readings have"} moved with it${span}.`
          : ""
      }`
    : "Relay's model found a pattern away from your usual in your recent readings.";
  const signals = moved.map((s) => s.id);
  const evidence = lead
    ? evidenceFor(p, moved)
    : "Based on Relay's model reading your recent readings against your usual.";
  if (due.due)
    return {
      id: "checkin",
      tone: "attention",
      icon: "checkin",
      title: "Complete your check-in",
      body: `${what} A short check-in gives your care team the context they need. In the meantime, follow the instructions on your discharge letter.`,
      evidence,
      cta: checkin(),
      signals,
    };
  // Not due: either the check-in is already with the care team, or this
  // pathway does not ask for one over a single reading. Either way the step is
  // the discharge letter, and the door to a check-in stays open.
  const answered = p.answered?.answeredAt;
  return {
    id: "settle",
    tone: "attention",
    icon: "plan",
    title: "Follow your discharge instructions today",
    body: answered
      ? `${what} Your care team has your check-in from ${ago(now - answered)}. Keep to the instructions on your discharge letter, and check in again if anything has changed.`
      : `${what} Your care team can see your readings. Keep to the instructions on your discharge letter, and check in if you feel unwell.`,
    evidence,
    cta: checkin(answered ? "Check in again" : "Check in"),
    signals,
  };
}

function askedGuidance() {
  return {
    id: "asked",
    tone: "attention",
    icon: "checkin",
    title: "Complete the check-in your care team asked for",
    body: "Your care team has a few questions about how you are doing. It takes about two minutes, and your answers sit next to your readings.",
    evidence: "Requested by your care team, alongside your readings.",
    cta: checkin(),
    signals: [],
  };
}

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

// No reading to compare: the device is the step, never the reading.
function missingGuidance(p, missing) {
  const byDevice = Object.groupBy(
    missing,
    (s) => SIGNALS[s.id]?.device || s.device,
  );
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
      body: `There is no ${shorts} entry for today, so there is nothing to compare with your usual. Enter it the same way you usually do.`,
      cta: { label: "Add a reading", href: readingHref(signals[0].id) },
    };
  if (p.devices?.[device]?.connected === false)
    return {
      ...base,
      icon: device === "phone" ? "phone" : "watch",
      title: `Reconnect your ${name}`,
      body: `Your ${name} is not connected, so no ${shorts} readings are arriving. Reconnect it so your care team can see them.`,
      cta: { label: "Your data", href: CONNECT_HREF },
    };
  if (device === "phone")
    return {
      ...base,
      icon: "phone",
      title: "Carry your phone with you today",
      body: `There is no ${shorts} reading for today, so there is nothing to compare with your usual. The phone in your pocket measures it as you walk; check the Health app is still connected.`,
      cta: { label: "Your data", href: CONNECT_HREF },
    };
  const gap =
    nights > 1
      ? `Readings are missing for ${numberWord(nights)} of the last four nights, so there is little to compare with your usual.`
      : signals.every((s) => s.today === null || s.today === undefined)
        ? `There is no ${shorts} reading for last night, so there is nothing to compare with your usual.`
        : "Too few readings have arrived to compare with your usual.";
  return {
    ...base,
    icon: "watch",
    title: `Wear your ${name} tonight`,
    body: `${gap} Check it is charged, on your wrist and connected before you sleep.`,
    cta: { label: "Your data", href: CONNECT_HREF },
  };
}

function activityGuidance(p, s) {
  return {
    id: "activity",
    tone: "action",
    icon: "activity",
    title: "If your plan allows it, take one short walk today",
    body: `${observation(s)}. If your discharge plan allows activity, one short walk or the exercises you were given is enough for today. Stop and rest if you feel worse.`,
    evidence: evidenceFor(p, [s]),
    cta: null,
    signals: [s.id],
  };
}

function gaitGuidance(p, s) {
  return {
    id: "gait",
    tone: "action",
    icon: "gait",
    title: "Take extra care moving around today",
    body: `${observation(s)}. Keep to the exercises in your discharge plan, take your time when you stand up or turn, and check in if you feel less steady.`,
    evidence: evidenceFor(p, [s]),
    cta: s.moved ? checkin() : null,
    signals: [s.id],
  };
}

function sleepGuidance(p, s) {
  return {
    id: "sleep",
    tone: "action",
    icon: "sleep",
    title: "Keep a regular bedtime tonight",
    body: `${observation(s)}. Try a consistent bedtime tonight and avoid caffeine late in the day. Your care team can see this reading too.`,
    evidence: evidenceFor(p, [s]),
    cta: null,
    signals: [s.id],
  };
}

function painGuidance(p, s) {
  return {
    id: "pain",
    tone: s.moved ? "attention" : "action",
    icon: "pain",
    title: s.moved
      ? "Follow your pain plan and complete a check-in"
      : "Follow your prescribed pain plan",
    body: `${observation(s)}. Take your pain relief as prescribed. If it is getting worse rather than better, complete a check-in so your care team knows.`,
    evidence: evidenceFor(p, [s]),
    cta: s.moved ? checkin() : null,
    signals: [s.id],
  };
}

function weightGuidance(p, s) {
  return {
    id: "weight",
    tone: "action",
    icon: "weight",
    title: "Weigh again tomorrow under the same conditions",
    body: `${observation(s)}. Weigh yourself again tomorrow: same scale, same time, before breakfast. Follow any fluid or salt instructions your care team has given you${s.moved ? ", and complete a check-in if it keeps rising" : ""}.`,
    evidence: evidenceFor(p, [s]),
    cta: s.moved ? checkin() : null,
    signals: [s.id],
  };
}

// A reading that is a little away, or one whose change is not something to act
// on alone: say so, and point back at the plan.
function watchGuidance(p, changed) {
  const phrases = changed.map(
    (s) => `${s.short} ${directionWord(s)} ${spanText(s)}`,
  );
  const anyMoved = changed.some((s) => s.moved);
  return {
    id: "watch",
    tone: "calm",
    icon: "plan",
    title: "Keep to your discharge plan and your routine today",
    body: anyMoved
      ? `${cap(list(phrases))}. Your care team can see all of your readings. Follow your discharge plan today, and check in if you feel unwell.`
      : `${cap(list(phrases))}, but not by much. The rest are about your usual, and your care team can see them all. Nothing to change today.`,
    evidence: evidenceFor(p, changed),
    cta: null,
    signals: changed.map((s) => s.id),
  };
}

function usualGuidance(p, signals) {
  const n = signals.length;
  return {
    id: "usual",
    tone: "calm",
    icon: "usual",
    title: "Keep to your discharge plan and your routine today",
    body: `${n === 1 ? "The reading" : `All ${numberWord(n)} readings`} watched after ${p.profile?.after || "your stay"} ${n === 1 ? "is" : "are"} about your usual. Nothing to change today.`,
    evidence: evidenceFor(p, signals),
    cta: null,
    signals: signals.map((s) => s.id),
  };
}

function usualMetric(p, s) {
  return {
    id: "usual",
    tone: "calm",
    icon: "usual",
    title: "Nothing to change today",
    body: `${subject(s)} is about your usual (${values(s)}). Keep to your discharge plan and your routine.`,
    evidence: evidenceFor(p, [s]),
    cta: null,
    signals: [s.id],
  };
}

const vitalsUnusual = (p) =>
  (p.signals || []).some(
    (s) => comparable(s) && familyOf(s.id) === "vitals" && unusual(s),
  );

// The readings that call for a check-in on this pathway, or Relay's model did.
const concern = (p) =>
  (p.signals || []).some(
    (s) => comparable(s) && familyOf(s.id) === "vitals" && s.moved,
  ) || readingsAsk(p);

// Guidance for one reading, shown under its chart. Null when there is nothing
// to compare: no usual yet, or a signal this pathway does not track.
export function metricGuidance(s, p, now = Date.now()) {
  if (!comparable(s)) return null;
  const family = familyOf(s.id);
  if (!family) return null;
  if (s.today === null || s.today === undefined) return missingGuidance(p, [s]);
  if (!unusual(s)) return usualMetric(p, s);
  switch (family) {
    case "vitals":
      return s.moved
        ? checkinGuidance(p, [s], checkinDue(p, now), now)
        : watchGuidance(p, [s]);
    case "activity":
      return vitalsUnusual(p) ? watchGuidance(p, [s]) : activityGuidance(p, s);
    case "gait":
      return gaitGuidance(p, s);
    case "sleep":
      return sleepGuidance(p, s);
    case "pain":
      return painGuidance(p, s);
    case "weight":
      return weightGuidance(p, s);
    default:
      return null;
  }
}

// The one insight for Home. Most important first; at most one, so the screen
// stays calm. Always carries a link: to the check-in, the device page, or the
// reading it rests on.
export function homeGuidance(p, now = Date.now()) {
  const signals = (p.signals || []).filter(
    (s) => comparable(s) && familyOf(s.id),
  );
  const counted = signals.filter((s) => s.counted);
  const due = checkinDue(p, now);
  const withLink = (g) =>
    g && {
      ...g,
      cta:
        g.cta ||
        (g.signals.length === 1
          ? { label: "See this reading", href: readingHref(g.signals[0]) }
          : { label: "See your readings", href: READINGS_HREF }),
    };

  // 1. Readings that stayed away, or the model's pattern: the check-in.
  if (concern(p)) {
    const moved = signals.filter(
      (s) =>
        s.moved && (familyOf(s.id) === "vitals" || (p.moved || []).includes(s)),
    );
    return withLink(checkinGuidance(p, moved, due, now));
  }
  // 2. The care team asked, with nothing in the readings to point at.
  if (due.reason === "asked") return withLink(askedGuidance());
  // 3. Too few readings to compare: the device is the step.
  const missing = counted.filter((s) => s.today === null);
  const mostMissing =
    missing.length > 0 && missing.length * 2 >= counted.length;
  if (p.status === "nodata" || mostMissing) {
    // Name what is missing tonight when most of it is; otherwise whole nights
    // are missing, so name the device most of the readings come from.
    const worn = counted.filter(
      (s) => (SIGNALS[s.id]?.device || s.device) !== "manual",
    );
    const pool = mostMissing ? missing : worn.length ? worn : missing;
    if (pool.length) return withLink(missingGuidance(p, pool));
  }
  // 4. One reading a patient can do something about, moved before mild.
  const changed = signals.filter(unusual);
  const actionable = changed
    .filter((s) => FAMILY_RANK.includes(familyOf(s.id)))
    .filter((s) => familyOf(s.id) !== "activity" || !vitalsUnusual(p))
    .sort(
      (a, b) =>
        Number(b.moved) - Number(a.moved) ||
        FAMILY_RANK.indexOf(familyOf(a.id)) -
          FAMILY_RANK.indexOf(familyOf(b.id)) ||
        Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0),
    );
  if (actionable.length) {
    const s = actionable[0];
    const g = {
      gait: gaitGuidance,
      activity: activityGuidance,
      sleep: sleepGuidance,
      pain: painGuidance,
      weight: weightGuidance,
    }[familyOf(s.id)](p, s);
    return withLink(g);
  }
  // 5. A single reading missing from an otherwise complete night.
  if (missing.length) return withLink(missingGuidance(p, missing));
  // 6. Something a little away, or nothing at all: the plan.
  if (changed.length) return withLink(watchGuidance(p, changed));
  if (counted.length) return withLink(usualGuidance(p, counted));
  if (signals.length) return withLink(usualGuidance(p, signals));
  return null;
}

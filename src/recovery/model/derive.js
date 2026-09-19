// Pure functions from raw readings to everything the screens show. No React, no clock
// of its own, no stored results: call it again whenever a reading arrives.
// All wording is a deterministic template over the numbers, and describes readings only.
import {
  PROFILES,
  QUESTIONS,
  SIGNALS,
  ruleText,
  thresholdOf,
} from "./profiles.js";
import { ago, list, numberWord, sentence } from "../format.js";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const CONCERNING = ["A lot", "A little", "Yes"];

// How far a day sits from usual, in threshold units, signed toward the watched direction.
function levelOf(ratio) {
  const size =
    Math.abs(ratio) >= 1.5
      ? 3
      : Math.abs(ratio) >= 1
        ? 2
        : Math.abs(ratio) >= 0.5
          ? 1
          : 0;
  return ratio < 0 ? -size : size;
}

function deriveSignal(p, spec, dayHome, now) {
  const info = SIGNALS[spec.signal];
  const readings = p.readings[spec.signal] || [];
  const baseline = readings.filter((r) => r.t < p.admittedAt);
  const usual = baseline.length ? mean(baseline.map((r) => r.v)) : null;
  const sd =
    baseline.length > 1
      ? Math.sqrt(mean(baseline.map((r) => (r.v - usual) ** 2)))
      : 0;
  const step = usual === null ? null : thresholdOf(spec.thr, usual);
  const point = (from, to, day) => {
    const inDay = readings.filter((r) => r.t >= from && r.t < to);
    const v = inDay.length ? mean(inDay.map((r) => r.v)) : null;
    return {
      day,
      v,
      t: inDay[0]?.t ?? null,
      level:
        v === null || step === null
          ? null
          : levelOf((spec.dir * (v - usual)) / step),
    };
  };
  const before = [];
  for (let b = 7; b >= 1; b--)
    before.push(
      point(p.admittedAt - b * DAY, p.admittedAt - (b - 1) * DAY, -b),
    );
  const home = [];
  for (let d = 0; d <= dayHome; d++)
    home.push(
      point(p.dischargedAt + d * DAY, p.dischargedAt + (d + 1) * DAY, d),
    );

  // A run is the unbroken stretch of days past the threshold that reaches today.
  let runStart = null;
  for (
    let d = dayHome;
    d >= 0 && home[d].level !== null && home[d].level >= 2;
    d--
  )
    runStart = d;
  let towardDays = 0;
  for (
    let d = dayHome;
    d >= 0 && home[d].level !== null && home[d].level >= 1;
    d--
  )
    towardDays++;
  const runStartT = runStart === null ? null : home[runStart].t;
  const today = home[dayHome]?.v ?? null;
  const diff = today === null || usual === null ? null : today - usual;
  const sign = diff !== null && diff < 0 ? "-" : "+";
  const change =
    diff === null
      ? "No reading"
      : spec.thr.abs !== undefined
        ? `${sign}${Math.abs(diff).toFixed(info.digits || 1)} ${info.unit === "%" ? "points" : info.unit}`
        : `${sign}${Math.round((Math.abs(diff) / usual) * 100)}%`;
  const spike = home
    .slice(-7)
    .find(
      (h) =>
        h.level !== null &&
        h.level >= 2 &&
        (runStart === null || h.day < runStart),
    );
  return {
    id: spec.signal,
    ...info,
    counted: !!spec.counted,
    watchDir: spec.dir,
    rule: spec.counted ? ruleText(spec, info.unit) : null,
    usual,
    sd,
    // How far from usual counts, in the signal's unit, and the value where
    // counting starts in the watched direction. The charts draw both.
    step,
    threshold: step === null ? null : usual + spec.dir * step,
    before,
    home,
    today,
    change,
    todayLevel: home[dayHome]?.level ?? null,
    enoughBaseline: baseline.length >= 5,
    runStart,
    runStartT,
    towardDays,
    spikeDay: spike ? spike.day : null,
    spikeLevel: spike ? spike.level : 0,
    moved: runStartT !== null && now - runStartT >= DAY && baseline.length >= 5,
    fmt: (v) => (v === null || v === undefined ? "–" : v.toFixed(info.digits)),
  };
}

export function derive(p, now) {
  const profile = PROFILES[p.profile];
  const first = p.name.split(" ")[0];
  const dayHome = Math.max(0, Math.floor((now - p.dischargedAt) / DAY));
  const specs = [
    ...profile.counted.map((c) => ({ ...c, counted: true })),
    ...profile.recorded.map((signal) => ({
      signal,
      dir: SIGNALS[signal].dir,
      thr: SIGNALS[signal].thr,
    })),
  ];
  const signals = specs.map((spec) => deriveSignal(p, spec, dayHome, now));
  const counted = signals.filter((s) => s.counted);
  const moved = counted.filter((s) => s.moved);

  const pattern = moved.length >= profile.minMoved;
  const starts = moved.map((s) => s.runStartT);
  const patternStartT = pattern ? Math.max(...starts) : null;
  const patternStartDay = pattern
    ? Math.max(...moved.map((s) => s.runStart))
    : null;
  const hours = pattern ? Math.floor((now - patternStartT) / HOUR) : 0;

  // Coverage: a night is missing when most counted signals have no reading for it.
  const nightMissing = (d) =>
    counted.filter((s) => s.home[d].v === null).length > counted.length / 2;
  const allDays = [...Array(dayHome + 1).keys()];
  const missingNights = allDays.filter(nightMissing).length;
  const recentDays = allDays.slice(-4);
  const missingRecent = recentDays.filter(nightMissing).length;
  const noData =
    counted.filter((s) => s.enoughBaseline).length <= counted.length / 2 ||
    missingRecent >= recentDays.length / 2;

  const last = p.checkins[p.checkins.length - 1] || null;
  const pending = last && !last.answeredAt ? last : null;
  const answered = [...p.checkins].reverse().find((c) => c.answeredAt) || null;
  const answeredForPattern =
    pattern && answered && answered.answeredAt >= patternStartT;
  const status = noData
    ? "nodata"
    : pending
      ? "context"
      : pattern
        ? answeredForPattern
          ? "review"
          : "context"
        : "monitoring";
  const acknowledged = status === "review" && !!p.acknowledgedAt;
  const group = acknowledged ? "monitoring" : status;

  // The course at home, read off the worst counted signal each day.
  const dayMax = allDays.map((d) => {
    const levels = counted
      .map((s) => s.home[d].level)
      .filter((l) => l !== null);
    return levels.length ? Math.max(...levels) : null;
  });
  let raised = 0;
  while (raised <= dayHome && dayMax[raised] !== null && dayMax[raised] >= 1)
    raised++;
  // Walk back from the change (or from today): drifting days first, then the quiet stretch before them.
  const quiet = (d) => d >= 0 && dayMax[d] !== null && dayMax[d] <= 0;
  let cursor = pattern ? patternStartDay - 1 : dayHome;
  let driftDay = -1;
  while (cursor >= raised && dayMax[cursor] !== null && dayMax[cursor] >= 1)
    driftDay = cursor--;
  const settledTo = quiet(cursor) && cursor >= raised ? cursor : -1;
  let settledFrom = settledTo;
  while (settledFrom > raised && quiet(settledFrom - 1)) settledFrom--;
  const settled = settledTo >= 0;

  const countPhrase =
    moved.length === counted.length
      ? `all ${numberWord(counted.length)} signals`
      : `${numberWord(moved.length)} of the ${numberWord(counted.length)} signals`;
  const spiked = counted
    .filter((s) => s.spikeDay !== null)
    .sort((a, b) => b.spikeLevel - a.spikeLevel)[0];
  const spikeWorkout =
    spiked &&
    p.workouts.some(
      (w) =>
        Math.abs(w.t - (p.dischargedAt + spiked.spikeDay * DAY + DAY / 2)) <
        DAY,
    );
  const reports = answered
    ? Object.entries(answered.answers)
        .filter(
          ([q, a]) =>
            QUESTIONS[q]?.reports && q !== "medicine" && CONCERNING.includes(a),
        )
        .map(([q]) => QUESTIONS[q].reports)
    : [];

  let headline;
  if (noData)
    headline = `There are too few readings to describe ${first}'s recovery yet.`;
  else if (pattern && settled)
    headline = `${raised > 0 && settledFrom === raised ? `${first}'s readings settled back to usual by day ${settledFrom}` : `${first}'s readings were inside the usual range from day ${settledFrom} to day ${settledTo}`}. Since day ${driftDay >= 0 ? driftDay : patternStartDay}, ${countPhrase} counted for ${profile.after} have moved away${raised > 0 ? " again" : ""}, together.`;
  else if (pattern)
    headline = sentence(
      `${countPhrase} counted for ${profile.after} have been past their thresholds for ${hours} hours`,
    );
  else
    headline = `${first}'s counted signals are inside the usual range.${spiked ? ` A one-day ${spiked.watchDir > 0 ? "rise" : "drop"} in ${spiked.short} did not persist.` : ""}`;

  let line;
  if (noData)
    line = `Too few readings to compare with usual. ${numberWord(missingRecent, true)} of the last ${numberWord(recentDays.length)} nights ${missingRecent === 1 ? "is" : "are"} missing.`;
  else if (pattern) {
    const ups = moved.filter((s) => s.watchDir > 0).map((s) => s.short);
    const downs = moved.filter((s) => s.watchDir < 0).map((s) => s.short);
    const movement = [
      ups.length ? `${list(ups)} up` : "",
      downs.length ? `${list(downs)} down` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const tail = pending
      ? `Check-in sent ${ago(now - pending.requestedAt)}, not answered yet.`
      : answeredForPattern
        ? reports.length
          ? `Reports ${list(reports)}.`
          : "Check-in answered."
        : "No check-in sent yet.";
    line = `${sentence(`${movement}, for ${hours} hours`)} ${tail}`;
  } else if (pending)
    line = `Within usual range. Check-in sent ${ago(now - pending.requestedAt)}, not answered yet.`;
  else if (spiked)
    line = `A one-day ${spiked.watchDir > 0 ? "rise" : "drop"} in ${spiked.short}${spikeWorkout ? " after a recorded workout" : ""}. It did not persist.`;
  else line = "Within usual range.";

  const course = [];
  if (raised > 0)
    course.push(
      `raised for the first ${raised === 1 ? "day" : `${numberWord(raised)} days`}`,
    );
  if (settled)
    course.push(
      settledTo === dayHome
        ? `inside the usual range since day ${settledFrom}`
        : settledFrom === settledTo
          ? `inside the usual range on day ${settledFrom}`
          : `inside the usual range from day ${settledFrom} to day ${settledTo}`,
    );
  if (driftDay >= 0)
    course.push(
      `drifting ${pattern && driftDay === patternStartDay - 1 ? "on" : "since"} day ${driftDay}`,
    );
  if (pattern)
    course.push(`past thresholds since the night of day ${patternStartDay}`);
  const findings = [
    {
      label: "Course at home",
      text: noData
        ? "Not enough nights recorded to describe a course."
        : course.length
          ? sentence(list(course))
          : "No clear course yet.",
    },
  ];
  if (pattern) {
    const spread = (Math.max(...starts) - Math.min(...starts)) / HOUR;
    findings.push({
      label: "Onset",
      text: `${sentence(countPhrase, false)} crossed ${moved.length === 1 ? "its threshold" : `their thresholds ${spread < 12 ? "on the same night" : `within ${numberWord(Math.ceil(spread / 24))} days of each other`}`} and have stayed there for ${hours} hours.`,
    });
  }
  if (pattern || spiked) {
    const since = pattern
      ? patternStartT
      : p.dischargedAt + spiked.spikeDay * DAY;
    const workout = p.workouts.some((w) => w.t >= since - DAY / 2);
    const said = answered?.answers.activity;
    findings.push({
      label: "Activity",
      text: `${workout ? "A workout was recorded close to the change" : "No workout was recorded in that period"}${said === "No" ? `, and ${first} reports nothing more active than usual` : said === "Yes" ? `, and ${first} reports being more active than usual` : ""}.`,
    });
  }
  const others = signals.filter(
    (s) => !s.counted && s.todayLevel !== null && Math.abs(s.todayLevel) >= 2,
  );
  findings.push({
    label: "Also recorded",
    text: others.length
      ? `${others.map((s) => `${sentence(s.short, false)} is ${s.fmt(s.today)} ${s.unit} against a usual ${s.fmt(s.usual)}`).join(". ")}. Not counted for ${profile.after}.`
      : "The other recorded signals are close to the usual range.",
  });
  const deviceNotes = Object.values(p.devices).map((d) =>
    !d.sharing
      ? `${d.name} sharing is paused by the patient.`
      : d.live
        ? `${d.name} is live.`
        : `${d.name} synced ${ago(now - d.lastSync)}.`,
  );
  findings.push({
    label: "Data coverage",
    text: `${missingNights === 0 ? "No missing nights since coming home." : `${numberWord(missingNights, true)} of ${numberWord(dayHome + 1)} nights ${missingNights === 1 ? "has" : "have"} no readings.`} ${deviceNotes.join(" ")}`,
  });

  return {
    id: p.id,
    name: p.name,
    first,
    age: p.age,
    profile,
    profileId: p.profile,
    hospital: p.hospital,
    clinician: p.clinician,
    dayHome,
    windowDays: 30,
    stayDays: Math.round((p.dischargedAt - p.admittedAt) / DAY),
    dischargedAt: p.dischargedAt,
    devices: p.devices,
    signals,
    counted,
    moved,
    pattern,
    patternStartDay,
    hours,
    status,
    group,
    acknowledged,
    pending,
    answered,
    checkins: p.checkins,
    headline,
    line,
    findings,
    changedForPatient: counted.filter((s) => s.towardDays > 0),
  };
}

// Patients are replaced, never mutated, so the object itself is a safe cache key.
const cache = new WeakMap();
export function view(patient, now) {
  const hit = cache.get(patient);
  // Wording that depends on the clock ("12 minutes ago") is allowed to be a minute stale.
  if (hit && Math.abs(now - hit.now) < 60000) return hit.value;
  const value = derive(patient, now);
  cache.set(patient, { now, value });
  return value;
}

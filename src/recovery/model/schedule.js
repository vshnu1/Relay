// What the patient's dashboard needs to say today: which check-in is due, what to
// notify, what the last check-in means for them, and the report they can choose to
// send. Pure functions over the derived view (derive.js) plus the patient record.
import {
  PROFILES,
  QUESTIONS,
  isScheduledDay,
  toModelContext,
} from "./profiles.js";
import { list, numberWord } from "../format.js";

const DAY = 86400000;
const CONCERNING = ["A lot", "A little", "Yes"];

const sameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

// Is a routine check-in due today? Daily for the first week home, every other day
// after that, and never twice in one day.
const RECENT_ANSWER = 18 * 3600000;
export function checkinDue(p, now = Date.now()) {
  const answeredRecently = p.checkins.some(
    (c) => c.answeredAt && now - c.answeredAt < RECENT_ANSWER,
  );
  if (answeredRecently) return { due: false, reason: "answered" };
  if (p.pending) return { due: true, reason: "asked" };
  if (isScheduledDay(p.dayHome)) return { due: true, reason: "scheduled" };
  return { due: false, reason: "not-scheduled" };
}

export function nextScheduledDay(day) {
  let d = day + 1;
  while (d <= 30 && !isScheduledDay(d)) d++;
  return d <= 30 ? d : null;
}

// Concerning answers from the last check-in, in the doctor's words.
export function concerningReports(answered) {
  if (!answered) return [];
  return Object.entries(answered.answers)
    .filter(
      ([q, a]) =>
        QUESTIONS[q]?.reports && q !== "medicine" && CONCERNING.includes(a),
    )
    .map(([q]) => QUESTIONS[q].reports);
}

// What the last check-in means for the patient. Descriptive, never a diagnosis.
// level: "send" (worsening the answers do not explain), "explained" (activity or a
// one-off), "watch" (something to keep an eye on), "fine".
export function insight(p) {
  const answered = p.answered;
  const reports = concerningReports(answered);
  const missed = answered?.answers.medicine === "Yes";
  const active = answered?.answers.activity === "Yes";
  const moved = p.moved.map((s) => s.plain.toLowerCase());
  if (p.status === "nodata")
    return {
      level: "watch",
      title: "Not enough readings yet",
      body: "Your watch has not shared enough readings for a comparison. Wear it tonight and check it is connected.",
      send: false,
    };
  if (p.pattern && active && reports.length === 0)
    return {
      level: "explained",
      title: "Your readings moved, and activity may explain it",
      body: `${sentenceList(moved)} ${moved.length === 1 ? "has" : "have"} moved from your usual, and you told us you were more active than usual. Your care team will see both. Rest today and answer again tomorrow.`,
      send: false,
    };
  if (p.pattern && (reports.length > 0 || !active))
    return {
      level: "send",
      title: "Your readings and your answers point the same way",
      body: `${sentenceList(moved)} ${moved.length === 1 ? "has" : "have"} been away from your usual for ${p.hours} hours${reports.length ? `, and you reported ${list(reports)}` : ", and nothing you told us explains it"}. We recommend sending this report to your care team now.`,
      send: true,
    };
  if (reports.length > 0)
    return {
      level: "watch",
      title: "Your readings are usual, but you reported symptoms",
      body: `You reported ${list(reports)}. Your watch readings are inside your usual range. Your care team will see your answers; if it gets worse, send them a report.`,
      send: false,
    };
  if (missed)
    return {
      level: "watch",
      title: "Readings usual. Missed medicines noted",
      body: "Your readings are inside your usual range. You said you missed medicines; take the next dose as prescribed and tell your care team if you are unsure.",
      send: false,
    };
  return {
    level: "fine",
    title: "Nothing stands out today",
    body: "Your readings are inside your usual range and your answers raise nothing. Nothing is needed from you.",
    send: false,
  };
}

function sentenceList(items) {
  if (!items.length) return "Your readings";
  const text = list(items);
  return text[0].toUpperCase() + text.slice(1);
}

// Everything the dashboard should draw attention to, most important first.
export function notifications(p, now = Date.now()) {
  const out = [];
  const due = checkinDue(p, now);
  if (due.due)
    out.push({
      id: "checkin",
      kind: "action",
      title:
        due.reason === "asked"
          ? "Your care team has questions for you"
          : `Day ${p.dayHome} check-in`,
      body:
        due.reason === "asked"
          ? "Your readings changed. A few questions help them understand why."
          : "A few quick questions about today. About two minutes.",
      href: "#/patient/checkin",
      cta: "Answer now",
    });
  if (p.answered && !p.pending) {
    const i = insight(p);
    if (i.level === "send" && !alreadySent(p, p.answered.answeredAt))
      out.push({
        id: "report",
        kind: "alert",
        title: "We recommend sending a report to your care team",
        body: i.body,
        href: "#/patient/insight",
        cta: "See why",
      });
  }
  for (const a of p.appointments || [])
    if (a.t > now && a.t - now < 3 * DAY)
      out.push({
        id: `appt-${a.t}`,
        kind: "info",
        title: `Appointment ${sameDay(a.t, now) ? "today" : sameDay(a.t, now + DAY) ? "tomorrow" : "soon"}`,
        body: `${a.with}, ${a.where}, ${new Date(a.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.`,
        href: "#/patient/care",
        cta: "Details",
      });
  for (const m of p.messages || [])
    if (!m.readAt && now - m.t < 7 * DAY)
      out.push({
        id: `msg-${m.t}`,
        kind: "info",
        title: `Message from ${m.from}`,
        body: m.text,
        href: "#/patient/care",
        cta: "Read",
      });
  const notConnected = Object.entries(p.devices).filter(
    ([, d]) => d.connected === false,
  );
  if (notConnected.length && p.dayHome <= 2)
    out.push({
      id: "connect",
      kind: "info",
      title: "Connect your health data",
      body: `Connect ${list(notConnected.map(([, d]) => d.name))} so your care team sees your readings.`,
      href: "#/patient/connect",
      cta: "Connect",
    });
  return out;
}

export const alreadySent = (p, since) =>
  (p.reports || []).some((r) => r.sentAt >= (since || 0));

// The report the patient may send. Plain text so it fits an email body.
export function buildReport(p, now = Date.now()) {
  const i = insight(p);
  const lines = [
    `Recovery report for ${p.name}, day ${p.dayHome} at home after ${p.profile.after}.`,
    `Prepared ${new Date(now).toLocaleString()} from the Relay patient app. Sent by the patient.`,
    "",
    "What the readings show:",
    p.headline,
    "",
    `Today's readings against ${p.first}'s own usual:`,
    ...p.counted.map(
      (s) =>
        `- ${s.name}: ${s.today === null ? "no reading" : `${s.fmt(s.today)} ${s.unit}`} (usual ${s.fmt(s.usual)} ${s.unit}, ${s.change})${s.moved ? " - past threshold" : ""}`,
    ),
  ];
  const manual = p.signals.filter(
    (s) => s.device === "manual" && s.today !== null,
  );
  if (manual.length)
    lines.push(
      "",
      "Entered by the patient today:",
      ...manual.map((s) => `- ${s.name}: ${s.fmt(s.today)} ${s.unit}`),
    );
  if (p.answered)
    lines.push(
      "",
      `Check-in answered ${new Date(p.answered.answeredAt).toLocaleString()}:`,
      ...p.profile.questions
        .filter((q) => p.answered.answers[q])
        .map((q) => `- ${QUESTIONS[q].short}: ${p.answered.answers[q]}`),
      ...(p.answered.note ? ["", `Patient's note: ${p.answered.note}`] : []),
    );
  const recent = (p.journal || []).filter((j) => now - j.t < 3 * DAY);
  if (recent.length)
    lines.push(
      "",
      "Recorded by the patient in the last three days:",
      ...recent.map(
        (j) =>
          `- ${new Date(j.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}, ${j.kind}: ${j.text}`,
      ),
    );
  lines.push(
    "",
    `Why this report: ${i.title}. ${i.body}`,
    "",
    "Relay describes readings against the patient's own baseline. It does not diagnose. Every patient in this demo is synthetic.",
  );
  return {
    subject: `Recovery report: ${p.name}, day ${p.dayHome} after ${p.profile.after}`,
    body: lines.join("\n"),
    to: p.careEmail || "",
    modelContext: p.answered
      ? toModelContext(p.profileId, p.answered.answers)
      : null,
  };
}

export const mailto = ({ to, subject, body }) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const programOf = (profileId) => PROFILES[profileId]?.ml ?? null;
export const dayWord = (n) => (n === 1 ? "one day" : `${numberWord(n)} days`);

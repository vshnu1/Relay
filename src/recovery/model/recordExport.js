// A patient's copy of their own record: 45 CFR 164.524, the right of access. Pure, so
// it is covered by tests/recordExport.test.js. It takes the derived patient the app is
// already showing and returns everything Relay holds about them, in two forms: a
// machine-readable object, and plain text a person can read or print.
//
// The discharge code is left out on purpose. It is a credential, not part of the
// record, and a file that gets emailed or printed should not carry one.
import { SIGNALS } from "./profiles.js";

export const RECORD_FORMAT = "relay-patient-record/1";

const iso = (t) => (Number.isFinite(t) ? new Date(t).toISOString() : null);

export function buildRecordExport(p, now = Date.now()) {
  const readings = {};
  for (const [signal, list] of Object.entries(p.readings || {}))
    readings[signal] = {
      name: SIGNALS[signal]?.name || signal,
      unit: SIGNALS[signal]?.unit || null,
      source: "wearable",
      values: (list || []).map((r) => ({ at: iso(r.t), value: r.v })),
    };
  return {
    format: RECORD_FORMAT,
    generatedAt: iso(now),
    about:
      "Everything Relay holds about this patient, produced at the patient's request. Readings come from a wearable device and were not measured by a clinician.",
    patient: {
      name: p.name,
      age: p.age ?? null,
      recoveringFrom: p.profile?.name || null,
      hospital: p.hospital,
      clinician: p.clinician,
      careTeamEmail: p.careEmail || null,
      dischargedAt: iso(p.dischargedAt),
      stayDays: p.stayDays ?? null,
      monitoringWindowDays: p.windowDays ?? null,
    },
    dischargeNotes: p.notes || "",
    medications: p.medications || [],
    appointments: (p.appointments || []).map((a) => ({
      at: iso(a.t),
      with: a.with,
      where: a.where,
    })),
    devices: Object.values(p.devices || {}).map((d) => ({
      name: d.name,
      connected: !!d.connected,
      sharing: !!d.sharing,
      lastSync: iso(d.lastSync),
    })),
    checkIns: (p.checkins || []).map((c) => ({
      requestedAt: iso(c.requestedAt),
      answeredAt: iso(c.answeredAt),
      answers: c.answers || null,
      note: c.note || "",
    })),
    messages: (p.messages || []).map((m) => ({
      at: iso(m.t),
      from: m.from || m.by,
      sentBy: m.by,
      text: m.text,
      readAt: iso(m.readAt),
    })),
    journal: p.journal || [],
    reports: p.reports || [],
    modelSummary: p.analysis || null,
    readings,
  };
}

const day = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "not recorded";

// The same record as text. Readings are summarised per signal (count, first, last,
// latest value); the full series is in the JSON copy, and the text says so.
export function recordAsText(record) {
  const out = [];
  const line = (text = "") => out.push(text);
  const head = (text) => {
    line();
    line(text);
    line("-".repeat(text.length));
  };
  line("Your Relay record");
  line(`Produced ${day(record.generatedAt)} at your request.`);
  line(record.about);

  head("About you");
  line(`Name: ${record.patient.name}`);
  if (record.patient.age != null) line(`Age: ${record.patient.age}`);
  if (record.patient.recoveringFrom)
    line(`Recovering from: ${record.patient.recoveringFrom}`);
  line(`Hospital: ${record.patient.hospital}`);
  line(`Clinician: ${record.patient.clinician}`);
  line(`Discharged: ${day(record.patient.dischargedAt)}`);

  head("Discharge notes");
  line(record.dischargeNotes || "None written.");

  head("Medicines");
  if (record.medications.length)
    record.medications.forEach((m) => line(`- ${m}`));
  else line("None listed.");

  head("Appointments");
  if (record.appointments.length)
    record.appointments.forEach((a) =>
      line(`- ${day(a.at)}, ${a.with}, ${a.where}`),
    );
  else line("None booked.");

  head("Check-ins");
  if (record.checkIns.length)
    record.checkIns.forEach((c) => {
      line(`- ${c.answeredAt ? day(c.answeredAt) : "Not answered yet"}`);
      for (const [question, answer] of Object.entries(c.answers || {}))
        line(`    ${question}: ${answer}`);
      if (c.note) line(`    In your words: ${c.note}`);
    });
  else line("None yet.");

  head("Messages");
  if (record.messages.length)
    record.messages.forEach((m) =>
      line(`- ${day(m.at)}, ${m.from}: ${m.text}`),
    );
  else line("None yet.");

  head("Readings from your devices");
  const signals = Object.values(record.readings).filter((s) => s.values.length);
  if (signals.length)
    signals.forEach((s) => {
      const last = s.values[s.values.length - 1];
      line(
        `- ${s.name}: ${s.values.length} readings, ${day(s.values[0].at)} to ${day(last.at)}. Latest ${last.value}${s.unit ? ` ${s.unit}` : ""}.`,
      );
    });
  else line("None held.");
  line();
  line(
    "Every individual reading is in the data copy (the .json file) from the same page.",
  );
  return out.join("\n") + "\n";
}

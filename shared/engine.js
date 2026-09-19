export const METRICS = {
  rhr: {
    label: "Resting heart rate",
    unit: "bpm",
    base: 64,
    threshold: 10,
    color: "#c77b57",
    source: "Wearable",
  },
  hrv: {
    label: "Heart rate variability",
    unit: "ms",
    base: 48,
    threshold: 15,
    color: "#728db5",
    source: "Wearable",
  },
  respiratory: {
    label: "Respiratory rate",
    unit: "/min",
    base: 14,
    threshold: 10,
    color: "#8b80ab",
    source: "Wearable",
  },
  sleep: {
    label: "Sleep duration",
    unit: "h",
    base: 7.6,
    threshold: 15,
    color: "#aa9361",
    source: "Sleep tracker",
  },
  glucose: {
    label: "Glucose",
    unit: "mg/dL",
    base: 105,
    threshold: 15,
    color: "#668f84",
    source: "CGM",
  },
  spo2: {
    label: "Oxygen saturation",
    unit: "%",
    base: 98,
    threshold: 3,
    color: "#95a49a",
    source: "Pulse oximeter",
  },
};
export const HOUR = 3600000;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round = (x) => Math.round(x * 10) / 10;
export function normalize(events) {
  if (!Array.isArray(events) || !events.length || events.length > 10000)
    throw new Error("Supply 1–10,000 measurement records.");
  const ids = new Set();
  return events
    .map((e, i) => {
      if (!e || !Object.hasOwn(METRICS, e.metric))
        throw new Error(`Record ${i + 1}: unsupported metric.`);
      const m = METRICS[e.metric];
      if (
        typeof e.timestamp !== "string" ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(e.timestamp) ||
        !Number.isFinite(Date.parse(e.timestamp))
      )
        throw new Error(`Record ${i + 1}: timestamp must include timezone.`);
      if (
        typeof e.value !== "number" ||
        !Number.isFinite(e.value) ||
        e.value <= 0 ||
        e.value > 1000
      )
        throw new Error(`Record ${i + 1}: invalid measurement.`);
      if (e.unit !== m.unit)
        throw new Error(`Record ${i + 1}: expected unit ${m.unit}.`);
      if (
        typeof e.source !== "string" ||
        !e.source.trim() ||
        e.source.length > 100
      )
        throw new Error(
          `Record ${i + 1}: source is required (maximum 100 characters).`,
        );
      const timestamp = new Date(e.timestamp).toISOString();
      const key = `${e.metric}:${timestamp}`;
      if (ids.has(key))
        throw new Error(`Record ${i + 1}: duplicate metric/timestamp.`);
      ids.add(key);
      return {
        id: `obs-${e.metric}-${Date.parse(timestamp)}`,
        metric: e.metric,
        timestamp,
        value: e.value,
        unit: e.unit,
        source: e.source.trim(),
      };
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
export function simulate(scenario = "ambiguous", anchor = Date.now()) {
  const end = Math.floor(anchor / (6 * HOUR)) * 6 * HOUR;
  const shifts = {
    rhr: 0.14,
    hrv: -0.24,
    respiratory: 0.17,
    sleep: -0.22,
    glucose: 0.19,
    spo2: 0,
  };
  const events = [];
  for (let i = 0; i <= 62; i++)
    for (const [metric, m] of Object.entries(METRICS)) {
      const recent = i >= 56;
      const fluctuation =
        scenario === "explained" &&
        i === 59 &&
        ["rhr", "glucose"].includes(metric);
      const shift =
        recent && scenario !== "explained"
          ? shifts[metric]
          : fluctuation
            ? 0.2
            : 0;
      events.push({
        metric,
        value: round(
          m.base *
            (1 +
              shift +
              Math.sin(i * 1.7 + Object.keys(METRICS).indexOf(metric)) * 0.017),
        ),
        unit: m.unit,
        timestamp: new Date(end - (62 - i) * 6 * HOUR).toISOString(),
        source: `Simulated ${m.source}`,
      });
    }
  return normalize(events);
}
export function cadenceHours(events) {
  const gaps = Object.keys(METRICS)
    .flatMap((metric) => {
      const times = events
        .filter((e) => e.metric === metric)
        .map((e) => Date.parse(e.timestamp))
        .sort((a, b) => a - b);
      return times
        .slice(1)
        .map((t, i) => (t - times[i]) / HOUR)
        .filter((x) => x > 0 && x <= 48);
    })
    .sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 6;
}
export function calculateBaseline(events) {
  const end = Math.max(...events.map((e) => Date.parse(e.timestamp)));
  const cutoff = end - Math.max(36, cadenceHours(events) * 3) * HOUR;
  return Object.fromEntries(
    Object.keys(METRICS).map((metric) => {
      const history = events.filter(
        (e) =>
          e.metric === metric &&
          Date.parse(e.timestamp) < cutoff &&
          Date.parse(e.timestamp) >= cutoff - 14 * 24 * HOUR,
      );
      const values = history.map((e) => e.value);
      const avg = values.length ? mean(values) : null;
      const span =
        history.length > 1
          ? (Date.parse(history.at(-1).timestamp) -
              Date.parse(history[0].timestamp)) /
            HOUR
          : 0;
      return [
        metric,
        {
          mean: avg,
          sd:
            avg === null
              ? null
              : Math.sqrt(mean(values.map((x) => (x - avg) ** 2))),
          count: values.length,
          sufficient: values.length >= 12 && span >= 72,
          start: history[0]?.timestamp,
          end: history.at(-1)?.timestamp,
        },
      ];
    }),
  );
}
export function detect(events, baselines) {
  const cadence = cadenceHours(events);
  const end = Math.max(...events.map((e) => Date.parse(e.timestamp)));
  const cutoff = end - Math.max(36, cadenceHours(events) * 3) * HOUR;
  const signals = Object.entries(METRICS).map(([metric, m]) => {
    const b = baselines[metric];
    const recent = events.filter(
      (e) => e.metric === metric && Date.parse(e.timestamp) >= cutoff,
    );
    const current = recent.length ? mean(recent.map((e) => e.value)) : null;
    const delta =
      b.mean && current !== null ? ((current - b.mean) / b.mean) * 100 : null;
    // A persistent run must end at the latest sample and cannot bridge gaps > 8h.
    let run = [];
    for (const e of recent) {
      const d = b.mean ? ((e.value - b.mean) / b.mean) * 100 : 0;
      if (Math.abs(d) < m.threshold || Math.sign(d) !== Math.sign(delta)) {
        run = [];
        continue;
      }
      if (
        run.length &&
        Date.parse(e.timestamp) - Date.parse(run.at(-1).timestamp) >
          Math.max(8, cadence * 1.5) * HOUR
      )
        run = [];
      run.push(e);
    }
    const duration =
      run.length > 1
        ? (Date.parse(run.at(-1).timestamp) - Date.parse(run[0].timestamp)) /
          HOUR
        : 0;
    const fresh =
      recent.length > 0 &&
      end - Date.parse(recent.at(-1).timestamp) <=
        Math.max(8, cadence * 1.5) * HOUR;
    const flagged = b.sufficient && fresh && run.length >= 3 && duration >= 24;
    return {
      metric,
      ...m,
      baseline: b,
      current: current === null ? null : round(current),
      delta: delta === null ? null : round(delta),
      duration,
      flagged,
      fresh,
      recent,
      sourceIds: run.map((e) => e.id),
      start: run[0]?.timestamp,
      end: run.at(-1)?.timestamp,
      quality: !b.sufficient
        ? "Insufficient baseline"
        : !fresh
          ? "Missing recent data"
          : "Available",
    };
  });
  const candidates = signals.filter((s) => s.flagged);
  const overlap =
    candidates.length >= 3
      ? (Math.min(...candidates.map((s) => Date.parse(s.end))) -
          Math.max(...candidates.map((s) => Date.parse(s.start)))) /
        HOUR
      : 0;
  return {
    cadenceHours: cadenceHours(events),
    windowHours: Math.max(36, cadenceHours(events) * 3),
    signals,
    coordinated: candidates.length >= 3 && overlap >= 24,
    overlapHours: Math.max(0, overlap),
    analyzedThrough: new Date(end).toISOString(),
  };
}
export function compile(analysis, context = null) {
  const contributing = analysis.signals.filter((s) => s.flagged);
  const state = analysis.coordinated
    ? context
      ? "review"
      : "context"
    : "quiet";
  const statements = contributing.map(
    (s) =>
      `${s.label} was ${Math.abs(s.delta)}% ${s.delta >= 0 ? "above" : "below"} baseline for ${s.duration} hours.`,
  );
  let summary = analysis.coordinated
    ? statements.join(" ")
    : "No persistent coordinated deviation met the demo review rule. Inspect data coverage before interpreting this result.";
  if (context) {
    summary += ` Patient-reported context: recent exercise — ${context.exercise}; fatigue — ${context.fatigue}; medication changes — ${context.medication}.`;
    if (context.notes) summary += ` Additional note — ${context.notes}.`;
  } else if (analysis.coordinated)
    summary += "Patient context is missing; a consented check-in is available.";
  return {
    ...analysis,
    state,
    summary,
    context,
    rule: "At least 3 signals, each ≥ its configured percent threshold for ≥24 hours, with ≥24 hours of shared overlap. Baseline: preceding 14 days; minimum 12 samples spanning 72 hours. At least 3 consecutive samples per signal; gaps >1.5× observed cadence (minimum 8h) break persistence. Recent window: 36h or 3 sampling intervals, whichever is longer. Demo rules, not clinically validated.",
  };
}
export function analyze(events, context = null) {
  const normalized = normalize(events);
  return compile(detect(normalized, calculateBaseline(normalized)), context);
}
export function fhirBundle(patient) {
  const reference = `Patient/${patient.id}`;
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: patient.id,
          identifier: [{ system: "urn:relay:synthetic", value: patient.id }],
        },
      },
      ...patient.evidence.signals
        .filter((s) => s.flagged)
        .flatMap((s) =>
          s.recent
            .filter((e) => s.sourceIds.includes(e.id))
            .map((e) => ({
              resource: {
                resourceType: "Observation",
                id: e.id,
                status: "final",
                code: { text: s.label },
                subject: { reference },
                effectiveDateTime: e.timestamp,
                valueQuantity: { value: e.value, unit: e.unit },
                note: [{ text: `${e.source}. Synthetic demo measurement.` }],
              },
            })),
        ),
      {
        resource: {
          resourceType: "Communication",
          id: `communication-${patient.id}`,
          status: "completed",
          subject: { reference },
          payload: [{ contentString: patient.evidence.summary }],
        },
      },
      {
        resource: {
          resourceType: "Task",
          id: `task-${patient.id}`,
          status: "requested",
          intent: "proposal",
          for: { reference },
          description:
            "Mock provider review of statistical evidence; no clinical recommendation.",
        },
      },
    ],
  };
}

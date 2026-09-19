import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useAnalysis } from "../patient/useAnalysis.js";

// The model, shown to the person the product is decision support for. Until now
// the score reached the patient app only; the clinician saw the deterministic
// rule and never the second opinion sitting beside it.
//
// The rule decides. This card corroborates or disagrees, and says which gates
// held when it stayed quiet, because "monitoring" and "not looking" are
// indistinguishable unless the system shows its ledger.

const STATE = {
  monitoring: "Nothing unusual",
  context_needed: "Unusual, context needed",
  review_recommended: "Unusual, ready for review",
  insufficient_data: "Cannot see enough",
};

const GATE = {
  coordinated_signals: "Signals moving together",
  persistence: "Persisted across windows",
  anomaly_score: "Model score",
  data_quality: "Enough recent data",
};

function readingsRundown(patient) {
  const moved = (patient.moved || []).slice(0, 4);
  if (patient.status === "nodata")
    return {
      headline:
        "There is not enough recent wearable data to compare with this patient’s usual.",
      signals: [],
    };
  if (!moved.length)
    return {
      headline:
        "No watched reading is currently past its persistent threshold compared with this patient’s usual.",
      signals: [],
    };
  return {
    headline: `${moved.length} watched ${moved.length === 1 ? "signal is" : "signals are"} outside this patient’s usual range${moved.some((signal) => signal.towardDays) ? " and have persisted" : ""}.`,
    signals: moved,
  };
}

// The model's contributors against the rule's flags. Moved here from the
// activity panel: it is a statement about the model, and it belongs beside the
// model's own verdict rather than under a list of what the patient has done.
const MODEL_TO_SIGNAL = {
  rhr: "restingHr",
  hrv: "hrv",
  respiratory: "breathing",
  spo2: "oxygen",
  sleep: "sleep",
  heart_rate: "avgHr",
  weight: "weight",
  temperature: "temperature",
  skin_temperature: "skinTemp",
};
const matches = (signal, contributor) =>
  MODEL_TO_SIGNAL[contributor.metric] === signal.id ||
  (contributor.label || "").toLowerCase() === signal.name.toLowerCase();

function crossCheck(p) {
  const a = p.analysis;
  if (!a) return null;
  const labelOf = (c) => (c.label || c.metric).toLowerCase();
  const contributors = a.contributors || [];
  const both = contributors.filter((c) => p.moved.some((s) => matches(s, c)));
  return {
    both: both.map(labelOf),
    modelOnly: contributors.filter((c) => !both.includes(c)).map(labelOf),
    ruleOnly: p.moved
      .filter((s) => !contributors.some((c) => matches(s, c)))
      .map((s) => s.name.toLowerCase()),
  };
}

const list = (items) =>
  items.length < 2
    ? items[0] || ""
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export default function ModelCard({ patient: p }) {
  const { run, busy, error } = useAnalysis(p);
  useEffect(() => {
    // Score on arrival, as the patient's own home already does. Opening a
    // patient is the moment a clinician wants the second opinion; making them
    // press a button first meant the card usually sat empty beside a rule that
    // had already decided.
    if (!p.analysis) void run(p.answered ? p.answered.answers : null);
  }, [p.id]);
  const a = p.analysis;
  // The scorer returns a fixed metric list, not the program's, so metrics this
  // program never watches come back with an empty baseline and rendered as
  // "usual Not available". A row with no baseline of its own has nothing to
  // say about where this patient sits, so it is not a row.
  const check = crossCheck(p);
  const cohortRows = (a?.signals || []).filter(
    (s) => s.cohort && s.baseline && typeof s.baseline.median === "number",
  );
  const withheld = a?.guard?.withheld?.length || 0;
  const fallback = readingsRundown(p);

  return (
    <section className="rx-card rx-model" aria-label="Model view">
      <div className="rx-model-head">
        <div>
          <h2 className="rx-kicker">Model view</h2>
          <p className="rx-model-sub">
            See the model&apos;s assessment alongside the readings behind the
            recovery-watch status.
          </p>
        </div>
        <button
          type="button"
          className="rx-model-run"
          onClick={() => run(p.answered ? p.answered.answers : null)}
          disabled={busy}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {busy ? "Scoring…" : a ? "Run ML again" : "Try ML scoring"}
        </button>
      </div>

      {!a && (
        <div className="rx-model-fallback" aria-live="polite">
          <div className="rx-model-state">
            <span className="rx-pill rx-pill-monitoring">
              {error ? "Readings + watch rules" : "Reading-based rundown"}
            </span>
          </div>
          <p className="rx-model-rundown">{fallback.headline}</p>
          {fallback.signals.length > 0 && (
            <ul className="rx-model-list">
              {fallback.signals.map((signal) => (
                <li key={signal.metric || signal.plain}>
                  <span>{signal.plain}</span>
                  <span className="rx-model-dir">
                    {signal.today === null
                      ? "No reading today"
                      : `${signal.fmt(signal.today)} ${signal.unit}, ${signal.change} from usual`}
                    {signal.towardDays
                      ? ` · ${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="rx-model-fine" role={error ? "status" : undefined}>
            {error
              ? "ML scoring did not return a result. This rundown uses wearable readings and Relay’s recovery-watch rules."
              : "Based on wearable readings and Relay’s recovery-watch rules. ML scoring has not run for this patient."}
          </p>
        </div>
      )}

      {!a ? null : (
        <>
          <div className="rx-model-state">
            <span className={`rx-pill rx-pill-${a.application_state}`}>
              {STATE[a.application_state] || a.application_state}
            </span>
            {a.anomaly_score !== null && a.anomaly_score !== undefined && (
              <span className="rx-model-score">
                score {a.anomaly_score.toFixed(2)}
                <small> · 0.50 is the line</small>
              </span>
            )}
          </div>

          {/* What the model adds that the page has not already said. Which
              signals moved is stated by the summary above, by the readings
              table, and by the chart; repeating it here in standard deviations
              made a fourth telling. What only the model can say is whether it
              agrees with the rule, and where it does not. */}
          {check && (
            <div className="rx-model-block">
              <h3>Against the recovery watch</h3>
              <ul className="rx-agree">
                <li className="both">
                  <span className="rx-agree-label">Both flag</span>
                  <span>
                    {check.both.length ? list(check.both) : "nothing in common"}
                  </span>
                </li>
                {check.modelOnly.length > 0 && (
                  <li className="model">
                    <span className="rx-agree-label">Model only</span>
                    <span>{list(check.modelOnly)}</span>
                  </li>
                )}
                {check.ruleOnly.length > 0 && (
                  <li className="rule">
                    <span className="rx-agree-label">Watch only</span>
                    <span>{list(check.ruleOnly)}</span>
                  </li>
                )}
              </ul>
              <p className="rx-model-fine">
                {check.modelOnly.length || check.ruleOnly.length
                  ? "Where they differ, the rule decides what is surfaced. The model never adds a signal that was not recorded."
                  : "The two agree on every signal. Each contributor is a measured deviation from this patient\u2019s own baseline."}
              </p>
            </div>
          )}

          {cohortRows.length > 0 && (
            <div className="rx-model-block">
              <h3>This patient among others</h3>
              <ul className="rx-cohort-list">
                {cohortRows.slice(0, 4).map((s) => (
                  <li key={s.metric}>
                    <span className="rx-cohort-name">{s.label}</span>
                    <span className="rx-cohort-fact">
                      usually <strong>{s.baseline.median}</strong> {s.unit}
                      {s.cohort.patient_percentile === null
                        ? ""
                        : `, ${s.cohort.patient_percentile}th percentile among ${s.cohort.subjects} others`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="rx-model-fine">
                Where people differ from each other more than they vary day to
                day, one shared threshold cannot serve them all. That is why the
                baseline is this patient&apos;s own.
              </p>
            </div>
          )}

          {a.restraint && (
            <>
              <h3>
                {a.restraint.escalated
                  ? "Why it was surfaced"
                  : "Why it stayed quiet"}
              </h3>
              <ul className="rx-ledger">
                {a.restraint.checks.map((c) => (
                  <li
                    key={c.gate}
                    className={c.met ? "rx-ledger-met" : "rx-ledger-miss"}
                  >
                    <span className="rx-ledger-gate">
                      {GATE[c.gate] || c.gate}
                    </span>
                    <span className="rx-ledger-val">
                      {String(c.observed)} / {String(c.required)}
                    </span>
                    <span className="rx-ledger-detail">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="rx-model-fine">
                {a.restraint.near_miss && (
                  <strong>One gate was missed by a single step. </strong>
                )}
                {a.restraint.note}
              </p>
            </>
          )}

          {withheld > 0 && (
            <p className="rx-guard-note">
              {withheld} sentence{withheld === 1 ? "" : "s"} withheld by the
              language guard and replaced with a description of the readings.
            </p>
          )}
        </>
      )}
    </section>
  );
}

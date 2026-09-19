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

          <div className="rx-model-tables">
            {a.contributors?.length > 0 && (
              <div className="rx-model-block">
                <h3>What moved most</h3>
                <table className="rx-mtable">
                  <thead>
                    <tr>
                      <th scope="col">Signal</th>
                      <th scope="col">Against their own usual</th>
                      <th scope="col" className="num">
                        Spreads
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.contributors.slice(0, 4).map((c) => (
                      <tr key={c.metric}>
                        <th scope="row">{c.label}</th>
                        <td>
                          {c.direction === "above_baseline" ? "above" : "below"}{" "}
                          usual
                        </td>
                        <td className="num">
                          {typeof c.robust_deviation === "number"
                            ? `${c.robust_deviation > 0 ? "+" : "−"}${Math.abs(c.robust_deviation).toFixed(1)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rx-model-fine">
                  One spread is how far this patient usually varies from day to
                  day, so +4 means four of their own normal days&apos; worth of
                  change, not four of anyone else&apos;s.
                </p>
              </div>
            )}

            {cohortRows.length > 0 && (
              <div className="rx-model-block">
                <h3>This patient among others</h3>
                <table className="rx-mtable">
                  <thead>
                    <tr>
                      <th scope="col">Signal</th>
                      <th scope="col" className="num">
                        Their usual
                      </th>
                      <th scope="col" className="num">
                        Range across others
                      </th>
                      <th scope="col" className="num">
                        Others
                      </th>
                      <th scope="col" className="num">
                        Percentile
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortRows.slice(0, 4).map((s) => (
                      <tr key={s.metric}>
                        <th scope="row">{s.label}</th>
                        <td className="num strong">
                          {s.baseline.median} {s.unit}
                        </td>
                        <td className="num">
                          {s.cohort.lowest_baseline}–{s.cohort.highest_baseline}
                        </td>
                        <td className="num">{s.cohort.subjects}</td>
                        <td className="num">
                          {s.cohort.patient_percentile === null
                            ? "—"
                            : `${s.cohort.patient_percentile}th`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rx-model-fine">
                  Where people differ from each other more than they vary day to
                  day, one shared threshold cannot serve them all. That is why
                  the baseline is this patient&apos;s own.
                </p>
              </div>
            )}
          </div>

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

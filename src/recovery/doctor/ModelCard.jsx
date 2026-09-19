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

export default function ModelCard({ patient: p }) {
  const { run, busy, error } = useAnalysis(p);
  const a = p.analysis;
  const cohortRows = (a?.signals || []).filter((s) => s.cohort);
  const withheld = a?.guard?.withheld?.length || 0;

  return (
    <section className="rx-card rx-model" aria-label="Model view">
      <div className="rx-model-head">
        <div>
          <h2 className="rx-kicker">Model view</h2>
          <p className="rx-model-sub">
            A second opinion beside the rule. It has no reason attached; the
            rule above does.
          </p>
        </div>
        <button
          type="button"
          className="rx-model-run"
          onClick={() => run(p.answered ? p.answered.answers : null)}
          disabled={busy}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {busy ? "Scoring…" : a ? "Run again" : "Run the model"}
        </button>
      </div>

      {error && (
        <p className="rx-model-error" role="alert">
          {error}
        </p>
      )}

      {!a ? (
        <p className="rx-model-empty">
          Not scored yet. Run it to see whether the model agrees with the rule
          for {p.first}.
        </p>
      ) : (
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

          {a.contributors?.length > 0 && (
            <>
              <h3>What moved most</h3>
              <ul className="rx-model-list">
                {a.contributors.slice(0, 4).map((c) => (
                  <li key={c.metric}>
                    <span>{c.label}</span>
                    <span className="rx-model-dir">
                      {c.direction === "above_baseline" ? "above" : "below"}{" "}
                      usual
                      {typeof c.robust_deviation === "number" &&
                        ` · ${c.robust_deviation > 0 ? "+" : ""}${c.robust_deviation.toFixed(1)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {cohortRows.length > 0 && (
            <>
              <h3>This patient among others</h3>
              <ul className="rx-model-list rx-cohort">
                {cohortRows.slice(0, 4).map((s) => (
                  <li key={s.metric}>
                    <span>{s.label}</span>
                    <span>
                      usual {s.baseline?.median ?? "Not available"} {s.unit}; across{" "}
                      {s.cohort.subjects} people, baselines run{" "}
                      {s.cohort.lowest_baseline}–{s.cohort.highest_baseline}
                      {s.cohort.patient_percentile !== null &&
                        ` · ${s.cohort.patient_percentile}th percentile`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="rx-model-fine">
                Where people differ from each other more than they vary day to
                day, one shared threshold cannot serve them all. That is why the
                baseline is this patient&apos;s own.
              </p>
            </>
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

import { ArrowDown, ArrowUp, Brain } from "lucide-react";

// Relay's model, laid out so a patient can read it in one glance: a state,
// a score, the readings that drove it, and one sentence on what to do.
// Nothing here is a diagnosis; the states are the model's own four.
const STATES = {
  review_recommended: {
    label: "Unusual pattern",
    tone: "alert",
    meaning:
      "Your readings and your answers point the same way. Sending a report lets your care team look today.",
  },
  context_needed: {
    label: "Something changed",
    tone: "watch",
    meaning:
      "Your readings moved away from your usual. Your check-in answers help your care team understand why.",
  },
  monitoring: {
    label: "Nothing unusual",
    tone: "fine",
    meaning: "Your recent readings look like your usual. Nothing is needed.",
  },
  insufficient_data: {
    label: "Not enough readings",
    tone: "watch",
    meaning:
      "Relay needs more recent readings to judge. Wear your watch tonight and check it is connected.",
  },
};

const metricName = (c) =>
  String(c.label || c.metric || "a reading")
    .replace(/_/g, " ")
    .toLowerCase();

export default function ModelSummary({ patient: p, run, busy, error }) {
  const a = p.analysis;
  const state = a ? STATES[a.application_state] || STATES.monitoring : null;
  const score =
    a?.anomaly_score == null ? null : Math.round(a.anomaly_score * 100);
  const contributors = (a?.contributors || []).slice(0, 4);
  const missing = (a?.missing_signals || [])
    .filter((m) => m.core)
    .map((m) => m.metric.replace(/_/g, " "));
  return (
    <div className={`rx-ph-tile model wide ${state ? state.tone : ""}`}>
      <div className="rx-model-head">
        <span className="rx-ph-lane-icon">
          <Brain size={15} aria-hidden="true" />
        </span>
        <div>
          <span className="rx-ph-kicker">Relay's model</span>
          <strong>
            {busy && !a
              ? "Comparing your recent readings with your usual…"
              : state
                ? state.label
                : "Not scored yet"}
          </strong>
        </div>
        <button
          type="button"
          className="rx-ph-btn outline small"
          disabled={busy}
          onClick={() => run(p.answered ? p.answered.answers : null)}
        >
          {busy ? "Scoring…" : a ? "Score again" : "Score"}
        </button>
      </div>

      {a && score !== null && (
        <div className="rx-model-score" aria-label={`Score ${score} of 100`}>
          <div className="rx-model-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, score)}%` }} />
          </div>
          <span>
            <strong>{score}</strong> of 100 · how far from your usual
          </span>
        </div>
      )}

      {a && contributors.length > 0 && (
        <ul className="rx-model-list" aria-label="What moved">
          {contributors.map((c) => {
            const up = c.direction === "above_baseline";
            return (
              <li key={c.metric || c.label}>
                <span className={`rx-model-dir ${up ? "up" : "down"}`}>
                  {up ? (
                    <ArrowUp size={13} strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <ArrowDown size={13} strokeWidth={2.6} aria-hidden="true" />
                  )}
                </span>
                <span className="rx-model-name">{metricName(c)}</span>
                <span className="rx-model-how">
                  {up ? "higher" : "lower"} than your usual
                  {c.persistence_windows
                    ? ` · ${c.persistence_windows * 6}h`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {a && missing.length > 0 && (
        <p className="rx-model-note">Missing recently: {missing.join(", ")}.</p>
      )}

      <p className="rx-model-meaning">
        {a
          ? state.meaning
          : "Scoring compares your recent readings with your own usual and names what moved."}
      </p>

      {error && (
        <p className="rx-p-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

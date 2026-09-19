import { Brain } from "lucide-react";

// Relay's model in one glance: a state, a score, and one sentence that says
// what the numbers above add up to. The tiles already show each reading, so
// nothing is repeated here. Never a diagnosis; the states are the model's own.
const STATES = {
  review_recommended: { label: "Unusual pattern", tone: "alert" },
  context_needed: { label: "Something changed", tone: "watch" },
  monitoring: { label: "Nothing unusual", tone: "fine" },
  insufficient_data: { label: "Not enough readings", tone: "watch" },
};

function summary(p, a) {
  const moved = p.counted.filter((s) => s.moved).length;
  const total = p.counted.length;
  const n = (a.contributors || []).length || moved;
  const span = p.hours ? ` for about ${p.hours} hours` : "";
  const count = n
    ? `${Math.min(n, total)} of ${total} readings`
    : "Your readings";
  switch (a.application_state) {
    case "review_recommended":
      return `${count} have stayed away from your usual together${span}, and your answers do not explain it. Worth your care team's eyes today.`;
    case "context_needed":
      return `${count} have moved from your usual${span}. Your check-in answers tell your care team whether there is a simple reason.`;
    case "insufficient_data":
      return "Too few recent readings to judge. Wear your watch tonight and check it is connected.";
    default:
      return `All ${total} readings are inside your usual range. Nothing is needed.`;
  }
}

export default function ModelSummary({ patient: p, error }) {
  const a = p.analysis;
  const state = a ? STATES[a.application_state] || STATES.monitoring : null;
  const score =
    a?.anomaly_score == null ? null : Math.round(a.anomaly_score * 100);
  return (
    <div className={`rx-ph-tile model wide compact ${state ? state.tone : ""}`}>
      <div className="rx-model-head">
        <span className="rx-ph-lane-icon">
          <Brain size={15} aria-hidden="true" />
        </span>
        <div>
          <span className="rx-ph-kicker">Relay's model</span>
          <strong>
            {state ? state.label : "Not scored yet"}
            {score !== null && (
              <span className="rx-model-scorenum"> · {score} of 100</span>
            )}
          </strong>
        </div>
      </div>
      {score !== null && (
        <div className="rx-model-bar" aria-label={`Score ${score} of 100`}>
          <i style={{ width: `${Math.min(100, score)}%` }} />
        </div>
      )}
      <p className="rx-model-meaning">
        {a
          ? summary(p, a)
          : "Scores how far your recent readings sit from your own usual, 0 to 100."}
      </p>
      {error && (
        <p className="rx-p-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import { Loader2, Plus } from "lucide-react";
export default function AnalysisBar({
  patient,
  busy,
  scenario,
  setScenario,
  onRun,
}) {
  return (
    <div className="analysis-bar">
      <div>
        <span className="live-dot" />
        <strong>{patient.execution?.mode || "Local engine"}</strong>
        <span>
          {busy
            ? "Processing measurements…"
            : "Deterministic statistical analysis"}
        </span>
      </div>
      <div className="simulation-controls">
        {patient.dataType === "synthetic" && (
          <select
            aria-label="Demo scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          >
            <option value="ambiguous">Coordinated deviation</option>
            <option value="explained">Workout fluctuation</option>
            <option value="review">Completed check-in</option>
          </select>
        )}
        <button
          className="button primary"
          disabled={busy || !patient.consent}
          onClick={onRun}
        >
          {busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}{" "}
          {patient.dataType === "synthetic"
            ? "Simulate new data"
            : "Run analysis"}
        </button>
      </div>
    </div>
  );
}

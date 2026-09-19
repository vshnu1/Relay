import {
  ArrowDownLeft,
  ArrowUpRight,
  AudioLines,
  Check,
  FileJson,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Badge from "../../components/Badge.jsx";
export default function EvidenceBrief({
  patient,
  busy,
  setTab,
  onStartCheckin,
  onOpenFhir,
  onAcknowledge,
}) {
  const evidence = patient.evidence;
  return (
    <aside className="evidence-side">
      <section className="evidence-card panel">
        <div className="eyebrow">
          <Sparkles size={14} /> THE EVIDENCE BRIEF
        </div>
        <h2>
          {evidence.state === "quiet"
            ? "Measurements in context."
            : "A pattern worth reviewing."}
        </h2>
        <Badge state={evidence.state} />
        <p className="brief-summary">{evidence.summary}</p>
        <div className="contributing">
          <span>CONTRIBUTING SIGNALS</span>
          {evidence.signals
            .filter((s) => s.flagged)
            .map((s) => (
              <button
                key={s.metric}
                onClick={() => {
                  setTab("Why flagged");
                }}
              >
                <span>{s.label}</span>
                <strong>
                  {s.delta > 0 ? "+" : ""}
                  {s.delta}%{" "}
                  {s.delta > 0 ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownLeft size={13} />
                  )}
                </strong>
              </button>
            ))}
        </div>
        <div className="clinical-note">
          <ShieldCheck size={15} />
          <span>
            Statistical evidence only. Provider judgment remains essential.
          </span>
        </div>
        {!evidence.context && evidence.coordinated && (
          <button
            className="button primary full"
            disabled={!patient.consent}
            onClick={onStartCheckin}
          >
            <AudioLines size={16} /> Gather patient context
          </button>
        )}
        <button
          className="button secondary full"
          disabled={busy}
          onClick={onOpenFhir}
        >
          <FileJson size={16} /> View mock FHIR handoff
        </button>
        <button
          className="text-button full"
          disabled={busy || patient.acknowledged}
          onClick={onAcknowledge}
        >
          <Check size={15} />
          {patient.acknowledged ? "Review acknowledged" : "Acknowledge review"}
        </button>
      </section>
      <section className="method-card">
        <div>
          <SlidersHorizontal size={15} />
          <strong>Transparent by design</strong>
        </div>
        <p>{evidence.rule}</p>
        <span>Template-generated summary · source-linked facts</span>
      </section>
    </aside>
  );
}

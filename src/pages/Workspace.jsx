import { useState } from "react";
import { Loader2 } from "lucide-react";
import PatientList from "./workspace/PatientList.jsx";
import PatientHeader from "./workspace/PatientHeader.jsx";
import AnalysisBar from "./workspace/AnalysisBar.jsx";
import Timeline from "./workspace/Timeline.jsx";
import EvidenceBrief from "./workspace/EvidenceBrief.jsx";
import WorkflowStrip from "./workspace/WorkflowStrip.jsx";
export default function Workspace({
  patients,
  patient,
  selected,
  status,
  busy,
  tab,
  setTab,
  onSelect,
  onRun,
  onStartCheckin,
  onOpenFhir,
  onAcknowledge,
}) {
  const [scenario, setScenario] = useState("ambiguous");
  return (
    <div className="workspace-grid">
      <PatientList
        patients={patients}
        selected={selected}
        busy={busy}
        onSelect={onSelect}
      />
      <div className="patient-workspace">
        {patient ? (
          <>
            <PatientHeader patient={patient} />
            <AnalysisBar
              patient={patient}
              busy={busy}
              scenario={scenario}
              setScenario={setScenario}
              onRun={() => onRun(scenario)}
            />
            <div className="evidence-grid">
              <Timeline
                patient={patient}
                tab={tab}
                setTab={setTab}
                onStartCheckin={onStartCheckin}
              />
              <EvidenceBrief
                patient={patient}
                busy={busy}
                setTab={setTab}
                onStartCheckin={onStartCheckin}
                onOpenFhir={onOpenFhir}
                onAcknowledge={onAcknowledge}
              />
            </div>
            <WorkflowStrip status={status} evidence={patient.evidence} />
          </>
        ) : (
          <div className="loading">
            <Loader2 className="spin" /> Loading patient workspace…
          </div>
        )}
      </div>
    </div>
  );
}

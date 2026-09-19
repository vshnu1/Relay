import { ShieldCheck, Watch } from "lucide-react";
import Badge from "../../components/Badge.jsx";
import { date } from "../../format.js";
export default function PatientHeader({ patient }) {
  const evidence = patient.evidence;
  return (
    <section className="patient-header panel">
      <div className="patient-title">
        <div className="avatar large">{patient.initials}</div>
        <div>
          <h2>
            {patient.name} <span>{patient.id}</span>
          </h2>
          <p>
            {patient.dataType === "synthetic"
              ? "Synthetic demo patient"
              : "De-identified wearable dataset"}
            <span>·</span>
            {patient.events.length} measurements
          </p>
        </div>
        <Badge state={evidence.state} />
      </div>
      <div className="patient-meta">
        <span>
          <Watch size={14} />
          {new Set(patient.events.map((e) => e.source)).size} data sources
        </span>
        <span>
          <ShieldCheck size={14} />
          {patient.consent ? "Monitoring consent active" : "Consent revoked"}
        </span>
        <span>Latest data {date(evidence.analyzedThrough)}</span>
      </div>
    </section>
  );
}

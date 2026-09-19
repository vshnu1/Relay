import { AudioLines, ClipboardList, ShieldCheck, Users } from "lucide-react";
export default function Stats({ patients, queue }) {
  return (
    <div className="stats">
      <div>
        <span>
          MONITORED PATIENTS <Users size={16} />
        </span>
        <strong>{patients.length.toString().padStart(2, "0")}</strong>
        <small>Across connected sources</small>
      </div>
      <div>
        <span>
          PROVIDER REVIEW <ClipboardList size={16} />
        </span>
        <strong>
          {queue
            .filter((p) => p.evidence.state === "review")
            .length.toString()
            .padStart(2, "0")}
          <em>Ready</em>
        </strong>
        <small>Evidence and context available</small>
      </div>
      <div>
        <span>
          AWAITING CONTEXT <AudioLines size={16} />
        </span>
        <strong>
          {queue
            .filter((p) => p.evidence.state === "context")
            .length.toString()
            .padStart(2, "0")}
          <em className="amber">Check-in</em>
        </strong>
        <small>A few questions complete the story</small>
      </div>
      <div>
        <span>
          MONITORING CONSENT <ShieldCheck size={16} />
        </span>
        <strong>
          {patients.filter((p) => p.consent).length}
          <b> / {patients.length}</b>
        </strong>
        <small>Patients with active consent</small>
      </div>
    </div>
  );
}

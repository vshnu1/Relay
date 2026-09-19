import { ClipboardList, Download } from "lucide-react";
import { download } from "../api.js";
import { date } from "../format.js";
export default function Audit({ audit }) {
  return (
    <section className="panel audit">
      <div className="panel-heading">
        <h2>Workspace activity</h2>
        <button
          className="button secondary"
          onClick={() => download(audit, "relay-audit.json")}
        >
          <Download size={14} /> Export
        </button>
      </div>
      {audit.length ? (
        audit.map((a) => (
          <div className="audit-row" key={a.id}>
            <span className="audit-icon">
              <ClipboardList size={16} />
            </span>
            <div>
              <strong>{a.action.replaceAll(".", " / ")}</strong>
              <p>
                {a.patientId || "Workspace"} · {a.actor}
                {a.detail && ` · ${a.detail}`}
              </p>
            </div>
            <time>{date(a.at)}</time>
          </div>
        ))
      ) : (
        <div className="context-body">No activity recorded yet.</div>
      )}
    </section>
  );
}

import { Watch } from "lucide-react";
import Badge from "../components/Badge.jsx";
export default function Sources({ patients, busy, onToggleConsent }) {
  return (
    <section className="panel connections">
      <div className="panel-heading">
        <h2>Monitoring consent</h2>
        <Badge state="quiet">Local storage</Badge>
      </div>
      <p>
        Imported files stay in this local workspace. Cloud analysis and voice
        are limited to synthetic demo patients.
      </p>
      {patients.map((p) => (
        <div className="connection-row" key={p.id}>
          <Watch size={24} />
          <div>
            <h3>{p.name}</h3>
            <p>
              {p.dataType} · {p.measurementCount} measurements
            </p>
          </div>
          <Badge state={p.consent ? "quiet" : "context"}>
            {p.consent ? "Connected" : "Revoked"}
          </Badge>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => onToggleConsent(p)}
          >
            {p.consent ? "Revoke consent" : "Restore consent"}
          </button>
        </div>
      ))}
      <div className="method-card">
        <h3>Prototype privacy boundaries</h3>
        <p>
          This build uses a shared provider workspace, local JSON persistence,
          and an append-only application audit file. Per-user authentication,
          patient/nurse/admin authorization, per-source consent, encrypted
          database storage, retention automation, and independently immutable
          audit storage remain production work. This prototype is not HIPAA
          compliant.
        </p>
      </div>
    </section>
  );
}

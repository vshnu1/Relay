import { useState } from "react";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import Badge from "../../components/Badge.jsx";
import { states } from "../../format.js";
export default function PatientList({ patients, selected, busy, onSelect }) {
  const [query, setQuery] = useState("");
  return (
    <section className="patient-list panel">
      <div className="panel-heading">
        <h2>Review workspace</h2>
        <span className="number">{patients.length}</span>
      </div>
      <label className="search">
        <Search size={15} />
        <input
          aria-label="Search patients"
          placeholder="Find a patient…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="list-label">
        PATIENTS <span>STATUS</span>
      </div>
      {patients
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .map((p) => (
          <button
            key={p.id}
            className={`patient-card ${selected === p.id ? "selected" : ""}`}
            disabled={busy}
            onClick={() => onSelect(p.id)}
          >
            <div className={`avatar ${p.evidence.state}`}>{p.initials}</div>
            <div>
              <strong>{p.name}</strong>
              <small>
                {p.id} · {p.dataType}
              </small>
              <Badge state={p.acknowledged ? "quiet" : p.evidence.state}>
                {p.acknowledged ? "Acknowledged" : states[p.evidence.state]}
              </Badge>
            </div>
            <ChevronRight size={15} />
          </button>
        ))}
      <div className="queue-note">
        <ShieldCheck size={17} />
        <p>
          Review signals, not diagnoses.
          <br />
          You make the clinical decisions.
        </p>
      </div>
    </section>
  );
}

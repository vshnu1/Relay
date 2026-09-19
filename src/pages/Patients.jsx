import { ArrowRight } from "lucide-react";
import Badge from "../components/Badge.jsx";
export default function Patients({ patients, onOpen }) {
  return (
    <section className="panel patient-directory">
      {patients.map((p) => (
        <button key={p.id} onClick={() => onOpen(p.id)}>
          <div className="avatar">{p.initials}</div>
          <div>
            <h3>{p.name}</h3>
            <p>
              {p.dataType} · {p.measurementCount} measurements
            </p>
          </div>
          <Badge state={p.evidence.state} />
          <ArrowRight size={17} />
        </button>
      ))}
    </section>
  );
}

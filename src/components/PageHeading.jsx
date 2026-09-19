import { Upload } from "lucide-react";
export default function PageHeading({ page, onImport }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">REMOTE MONITORING INTELLIGENCE</div>
        <h1>
          {page === "workspace"
            ? "A clearer picture of care."
            : page === "patients"
              ? "Your monitoring cohort."
              : page === "sources"
                ? "Every signal, connected."
                : "A traceable record."}
        </h1>
        <p>
          {page === "workspace"
            ? "From scattered signals to evidence you can review."
            : page === "sources"
              ? "Manage consent and bring wearable measurements into one timeline."
              : page === "audit"
                ? "Review activity, check-ins, consent changes, and handoffs."
                : "Open a patient to explore their measurements and context."}
        </p>
      </div>
      <button className="button secondary" onClick={onImport}>
        <Upload size={16} /> Import data
      </button>
    </div>
  );
}

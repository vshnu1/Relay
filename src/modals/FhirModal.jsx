import { Download } from "lucide-react";
import { download } from "../api.js";
export default function FhirModal({ bundle, patientId }) {
  return (
    <>
      <div className="eyebrow">MOCK EHR HANDOFF</div>
      <h2>Evidence that travels.</h2>
      <p>
        FHIR-shaped Patient, Observation, Communication, and Task resources. No
        external EHR is connected; this export has not been validated against a
        FHIR profile.
      </p>
      <pre>{JSON.stringify(bundle, null, 2)}</pre>
      <button
        className="button primary"
        onClick={() => download(bundle, `relay-${patientId}-fhir.json`)}
      >
        <Download size={16} /> Download bundle
      </button>
    </>
  );
}

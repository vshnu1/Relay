import { useState } from "react";
import { ArrowRight, Database, Upload } from "lucide-react";
export default function ImportModal({ onImport, busy }) {
  const [payload, setPayload] = useState(null),
    [fileError, setFileError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [dataType, setDataType] = useState("de-identified");
  return (
    <>
      <div className="modal-symbol">
        <Database />
      </div>
      <div className="eyebrow">BRING YOUR OWN SIGNALS</div>
      <h2>Connect a wearable dataset.</h2>
      <p>
        Import normalized JSON from the wearable converter. Apple Watch CSV,
        WHOOP XLSX, and Apple Health XML converters are available in the
        repository.
      </p>
      <label className="upload-zone">
        <Upload size={24} />
        <strong>
          {payload
            ? `${payload.length} measurements ready`
            : "Choose a normalized JSON file"}
        </strong>
        <span>Up to 10,000 records · 3 MB maximum</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            setPayload(null);
            setFileError("");
            try {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024)
                throw new Error("File exceeds 3 MB.");
              const json = JSON.parse(await file.text());
              const events = Array.isArray(json) ? json : json.events;
              if (!Array.isArray(events))
                throw new Error("Expected an events array.");
              setPayload(events);
            } catch (err) {
              setFileError(err.message);
            }
          }}
        />
      </label>
      <label className="form-field">
        Dataset classification
        <select value={dataType} onChange={(e) => setDataType(e.target.value)}>
          <option value="de-identified">
            De-identified (local analysis only)
          </option>
          <option value="synthetic">Synthetic</option>
        </select>
      </label>
      <label className="consent-box">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        I confirm these records contain no identifying information and I am
        authorized to use them.
      </label>
      {fileError && <div className="alert">{fileError}</div>}
      <button
        className="button primary full"
        disabled={!payload || !confirmed || busy}
        onClick={() => onImport({ events: payload, dataType, confirmed })}
      >
        Import & analyze <ArrowRight size={15} />
      </button>
    </>
  );
}

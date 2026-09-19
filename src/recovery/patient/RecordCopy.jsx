import { useState } from "react";
import { FileDown } from "lucide-react";
import { authHeaders } from "../model/authHeaders.js";
import { buildRecordExport, recordAsText } from "../model/recordExport.js";
import "./record-copy.css";

// The right of access, 45 CFR 164.524: a patient may have a copy of their record in
// the form they ask for. The copy is assembled in this browser from what the app is
// already showing, in two forms, and saved as a file. Nothing is sent anywhere except
// one line to the patient's own record saying a copy was taken, so the access is on
// the audit trail like any other.
function save(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function noteCopyTaken(patientId, form) {
  const t = Date.now();
  fetch("/api/recovery/events", {
    method: "POST",
    headers: authHeaders({ discharge: true }),
    body: JSON.stringify({
      events: [
        {
          type: "record-copy",
          patientId,
          eid: `copy-${patientId}-${t}`,
          t,
          form,
        },
      ],
    }),
  }).catch(() => {
    // The copy is already saved. With no server (the open local demo) there is no
    // audit trail to add to.
  });
}

export default function RecordCopy({ patient: p }) {
  const [saved, setSaved] = useState("");
  const stem = `relay-record-${p.first.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
  const take = (form) => {
    const record = buildRecordExport(p);
    if (form === "text")
      save(`${stem}.txt`, recordAsText(record), "text/plain;charset=utf-8");
    else
      save(
        `${stem}.json`,
        JSON.stringify(record, null, 2),
        "application/json;charset=utf-8",
      );
    noteCopyTaken(p.id, form);
    setSaved(
      form === "text"
        ? "Saved a copy you can read or print."
        : "Saved a data copy.",
    );
  };
  return (
    <section
      className="rx-p-card rx-record-copy"
      aria-label="A copy of your record"
    >
      <div className="rx-p-status">
        <FileDown size={28} aria-hidden="true" />
        <div>
          <strong>A copy of your record</strong>
          <span>Yours to keep, or to give to another doctor</span>
        </div>
      </div>
      <p>
        Everything Relay holds about you: your discharge notes and medicines,
        appointments, check-ins, messages, and every reading from your devices.
        The copy is made on this device and saved as a file.
      </p>
      <div className="rx-record-copy-actions">
        <button
          type="button"
          className="rx-p-btn primary"
          onClick={() => take("text")}
        >
          Save a copy to read or print
        </button>
        <button type="button" className="rx-p-btn" onClick={() => take("data")}>
          Save a data copy (.json)
        </button>
      </div>
      <p className="rx-p-fine" role="status">
        {saved ||
          "The data copy has every individual reading, for another app or clinic to open. Your sign-in code is not included in either."}
      </p>
    </section>
  );
}

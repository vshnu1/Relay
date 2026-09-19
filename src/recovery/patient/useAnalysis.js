import { useState } from "react";
import { actions } from "../useRecovery.js";
import { scoreWithModel } from "../model/mlClient.js";

// Run the model for this patient and keep the result in the store. Screens share
// one hook so the button and the status text look the same everywhere.
export function useAnalysis(patient) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (answers = null) => {
    setBusy(true);
    setError("");
    try {
      const result = await scoreWithModel(
        { ...patient, readings: patient.readings },
        answers,
      );
      actions.setAnalysis(patient.id, result);
      return result;
    } catch (e) {
      setError(e.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error, analysis: patient.analysis };
}

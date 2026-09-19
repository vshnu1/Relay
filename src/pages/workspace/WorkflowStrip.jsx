import React from "react";
import { AudioLines, CheckCircle2, ChevronRight, Radio } from "lucide-react";
export default function WorkflowStrip({ status, evidence }) {
  return (
    <section className="workflow panel">
      <div>
        <Radio size={17} />
        <strong>Analysis pipeline</strong>
        <span>{status?.render ? "Render configured" : "Running locally"}</span>
      </div>
      <div className="workflow-steps">
        {[
          "Normalize",
          "Baseline",
          "Deviation",
          evidence.context
            ? "Context collected"
            : evidence.coordinated
              ? "Context needed"
              : "Context optional",
          "Evidence summary",
        ].map((step, i) => (
          <React.Fragment key={step}>
            <span className={step === "Context needed" ? "pending" : ""}>
              {step === "Context needed" ? (
                <AudioLines size={13} />
              ) : (
                <CheckCircle2 size={13} />
              )}{" "}
              {step}
            </span>
            {i < 4 && <ChevronRight size={12} />}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

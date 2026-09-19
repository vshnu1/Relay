import test from "node:test";
import assert from "node:assert/strict";
import {
  createAnalysisRunner,
  mapWorkflowResult,
} from "../server/workflowAnalysis.js";

const events = [
  {
    metric: "walking_speed",
    value: 0.8,
    unit: "m/s",
    timestamp: new Date().toISOString(),
    source: "synthetic",
  },
];
const modelEvidence = {
  application_state: "context_needed",
  state: "context",
  signals: [{ metric: "walking_speed" }],
  model: { status: "available" },
};

test("maps completed workflow result and preserves run provenance", () => {
  const mapped = mapWorkflowResult({
    status: "completed",
    id: "run-123",
    results: [
      {
        modelEvidence,
        deterministicEvidence: { state: "quiet", signals: [] },
        workflowProvenance: { commit: "abc123", branch: "main" },
        comparison: { statesAgree: false },
      },
    ],
  });
  assert.equal(mapped.evidence, modelEvidence);
  assert.equal(mapped.execution.id, "run-123");
  assert.equal(mapped.execution.fallback, false);
  assert.equal(mapped.execution.sourceCommit, "abc123");
});

test("rejects noncompleted or malformed workflow results", () => {
  assert.throws(
    () => mapWorkflowResult({ status: "failed", results: [] }),
    /completed model evidence/,
  );
});

test("invokes configured Render workflow with a single analysis payload", async () => {
  let request;
  const runner = createAnalysisRunner({
    env: { RENDER_API_KEY: "test", RENDER_WORKFLOW_SLUG: "relay-workflow" },
    runWorkflow: async (input) => {
      request = input;
      return {
        status: "completed",
        id: "wf-1",
        results: [{ modelEvidence, deterministicEvidence: null }],
      };
    },
  });
  const result = await runner({
    events,
    context: { notes: "brief" },
    patientId: "demo",
  });
  assert.deepEqual(request, {
    events,
    context: { notes: "brief" },
    program: "post_abdominal_surgery",
    patientId: "demo",
  });
  assert.equal(result.execution.mode, "Render Workflows");
});

test("clearly labels Python fallback when Workflow is unavailable", async () => {
  const runner = createAnalysisRunner({
    env: {
      RENDER_API_KEY: "test",
      RENDER_WORKFLOW_SLUG: "relay-workflow",
      RELAY_ML_ENABLED: "true",
    },
    runWorkflow: async () => {
      throw new Error("offline");
    },
    scoreModel: async () => modelEvidence,
    deterministic: () => ({ state: "quiet", signals: [] }),
    id: () => "fallback-1",
  });
  const result = await runner({ events });
  assert.equal(result.execution.fallback, true);
  assert.equal(result.execution.mode, "Web service Python fallback");
  assert.equal(result.execution.workflowStatus, "unavailable");
});

test("uses and labels rules fallback when Workflow and Python scoring are unavailable", async () => {
  const runner = createAnalysisRunner({
    env: { RELAY_ML_ENABLED: "false" },
    deterministic: () => ({ state: "review", signals: [{ metric: "rhr" }] }),
    id: () => "rules-1",
  });
  const result = await runner({
    events: [
      {
        metric: "rhr",
        value: 65,
        unit: "bpm",
        timestamp: new Date().toISOString(),
        source: "synthetic",
      },
    ],
  });
  assert.equal(result.evidence.application_state, "review_recommended");
  assert.equal(result.execution.mode, "Local rules fallback");
  assert.equal(result.execution.fallback, true);
});

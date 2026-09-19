import test from "node:test";
import assert from "node:assert/strict";
import { monitoringPipeline } from "../workflows/tasks.js";
import { simulate } from "../shared/engine.js";
test("Render task chain returns model and deterministic evidence with comparison", async () => {
  const called = [];
  const ctx = {
    run: async (task, ...args) => {
      called.push(task.name);
      if (task.name === "scoreWithPythonModel")
        return {
          state: "review",
          application_state: "review_recommended",
          signals: [{ metric: "rhr" }],
          model: { status: "available" },
        };
      return task.func(ctx, ...args);
    },
  };
  const result = await monitoringPipeline.func(ctx, {
    events: simulate(),
    context: null,
    program: "post_abdominal_surgery",
    patientId: "demo-test",
  });
  assert.deepEqual(called, [
    "scoreWithPythonModel",
    "ingestAndNormalize",
    "calculateBaseline",
    "detectCoordinatedDeviation",
    "requestContext",
    "compileReviewItem",
  ]);
  assert.equal(result.modelEvidence.application_state, "review_recommended");
  assert.equal(result.deterministicEvidence.state, "context");
  assert.deepEqual(result.comparison.sharedMetrics, ["rhr"]);
});

test("workflow rules retain evidence when only model-only metrics are supplied", async () => {
  const ctx = {
    run: async (task, ...args) =>
      task.name === "scoreWithPythonModel"
        ? {
            application_state: "monitoring",
            signals: [],
            model: { status: "available" },
          }
        : task.func(ctx, ...args),
  };
  const input = {
    events: [
      {
        metric: "walking_speed",
        value: 0.8,
        unit: "m/s",
        timestamp: new Date().toISOString(),
        source: "synthetic",
      },
    ],
  };
  const result = await monitoringPipeline.func(ctx, input);
  assert.equal(result.modelEvidence.application_state, "monitoring");
  assert.equal(result.deterministicEvidence.state, "context");
  assert.deepEqual(result.deterministicEvidence.unsupportedMetrics, [
    "walking_speed",
  ]);
});

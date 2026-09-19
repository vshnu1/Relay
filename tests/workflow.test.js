import test from "node:test";
import assert from "node:assert/strict";
import { monitoringPipeline } from "../workflows/tasks.js";
import { simulate } from "../shared/engine.js";
test("Render task chain passes normalized evidence through all five stages", async () => {
  const called = [];
  const ctx = {
    run: async (task, ...args) => {
      called.push(task.name);
      return task.func(ctx, ...args);
    },
  };
  const result = await monitoringPipeline.func(ctx, simulate(), null);
  assert.deepEqual(called, [
    "ingestAndNormalize",
    "calculateBaseline",
    "detectCoordinatedDeviation",
    "requestContext",
    "compileReviewItem",
  ]);
  assert.equal(result.state, "context");
});

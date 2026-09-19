import { task } from "@renderinc/sdk/workflows";
import {
  normalize,
  calculateBaseline,
  detect,
  compile,
} from "../shared/engine.js";
export const ingestAndNormalize = task(
  { name: "ingestAndNormalize" },
  async (_, events) => normalize(events),
);
export const baseline = task({ name: "calculateBaseline" }, async (_, events) =>
  calculateBaseline(events),
);
export const deviation = task(
  { name: "detectCoordinatedDeviation" },
  async (_, events, baselines) => detect(events, baselines),
);
export const requestContext = task(
  { name: "requestContext" },
  async (_, analysis, context) => ({
    required: analysis.coordinated && !context,
    context,
  }),
);
export const compileReviewItem = task(
  { name: "compileReviewItem" },
  async (_, analysis, context) => compile(analysis, context),
);
export const monitoringPipeline = task(
  { name: "monitoringPipeline", timeoutSeconds: 300 },
  async (ctx, events, context = null) => {
    const normalized = await ctx.run(ingestAndNormalize, events);
    const baselines = await ctx.run(baseline, normalized);
    const analysis = await ctx.run(deviation, normalized, baselines);
    const checkin = await ctx.run(requestContext, analysis, context);
    return ctx.run(compileReviewItem, analysis, checkin.context);
  },
);

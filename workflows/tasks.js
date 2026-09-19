import { task } from "@renderinc/sdk/workflows";
import {
  METRICS,
  normalize,
  calculateBaseline,
  detect,
  compile,
} from "../shared/engine.js";
import { scoreWithRelay } from "../server/relayModel.js";
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
export const scoreWithModel = task(
  { name: "scoreWithPythonModel", timeoutSeconds: 180 },
  async (_, input) => {
    try {
      return await scoreWithRelay({
        events: input.events,
        context: input.context,
        program: input.program,
        patientId: input.patientId,
      });
    } catch (error) {
      // A short history or missing model artifact should not discard the
      // deterministic evidence produced by the rest of this workflow.
      return { unavailable: true, reason: error.message };
    }
  },
);
export const monitoringPipeline = task(
  { name: "monitoringPipeline", timeoutSeconds: 300 },
  async (ctx, inputOrEvents, legacyContext = null) => {
    // Accept the former positional payload during a rolling deploy; new callers
    // use the object contract so program and patient provenance travel together.
    const input = Array.isArray(inputOrEvents)
      ? { events: inputOrEvents, context: legacyContext }
      : inputOrEvents;
    const { events, context = null } = input;
    const compatibleEvents = events.filter((event) =>
      Object.hasOwn(METRICS, event.metric),
    );
    let modelEvidence = await ctx.run(scoreWithModel, input);
    let deterministicEvidence;
    if (compatibleEvents.length) {
      const normalized = await ctx.run(ingestAndNormalize, compatibleEvents);
      const baselines = await ctx.run(baseline, normalized);
      const analysis = await ctx.run(deviation, normalized, baselines);
      const checkin = await ctx.run(requestContext, analysis, context);
      deterministicEvidence = await ctx.run(
        compileReviewItem,
        analysis,
        checkin.context,
      );
    } else {
      deterministicEvidence = {
        state: "context",
        signals: [],
        summary: "The rules review could not evaluate these reading types.",
        unsupportedMetrics: [...new Set(events.map((event) => event.metric))],
      };
    }
    if (modelEvidence.unavailable) {
      const applicationState =
        {
          quiet: "monitoring",
          context: "context_needed",
          review: "review_recommended",
        }[deterministicEvidence.state] || "insufficient_data";
      modelEvidence = {
        state: deterministicEvidence.state,
        application_state: applicationState,
        signals: deterministicEvidence.signals || [],
        summary:
          deterministicEvidence.summary ||
          "The model could not score this set of readings.",
        anomaly_score: null,
        model: { status: "unavailable" },
      };
    }
    const modelMetrics = new Set(
      modelEvidence.signals.map((signal) => signal.metric),
    );
    const ruleMetrics = new Set(
      deterministicEvidence.signals.map((signal) => signal.metric),
    );
    return {
      modelEvidence,
      deterministicEvidence,
      workflowProvenance: {
        commit: process.env.RENDER_GIT_COMMIT || null,
        branch: process.env.RENDER_GIT_BRANCH || null,
      },
      comparison: {
        modelState: modelEvidence.application_state,
        rulesState:
          {
            quiet: "monitoring",
            context: "context_needed",
            review: "review_recommended",
          }[deterministicEvidence.state] || null,
        statesAgree:
          modelEvidence.application_state && deterministicEvidence.state
            ? modelEvidence.application_state ===
              {
                quiet: "monitoring",
                context: "context_needed",
                review: "review_recommended",
              }[deterministicEvidence.state]
            : null,
        sharedMetrics: [...modelMetrics].filter((metric) =>
          ruleMetrics.has(metric),
        ),
        modelOnlyMetrics: [...modelMetrics].filter(
          (metric) => !ruleMetrics.has(metric),
        ),
        rulesOnlyMetrics: [...ruleMetrics].filter(
          (metric) => !modelMetrics.has(metric),
        ),
      },
    };
  },
);

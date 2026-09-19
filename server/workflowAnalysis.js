import { randomUUID } from "node:crypto";
import { scoreWithRelay } from "./relayModel.js";
import { analyze, METRICS } from "../shared/engine.js";

const states = {
  quiet: "monitoring",
  context: "context_needed",
  review: "review_recommended",
};

export function mapWorkflowResult(result) {
  const payload = result?.results?.[0];
  if (result?.status !== "completed" || !payload?.modelEvidence?.signals)
    throw new Error("Render Workflow did not return completed model evidence.");
  return {
    evidence: payload.modelEvidence,
    deterministicEvidence: payload.deterministicEvidence || null,
    comparison: payload.comparison || null,
    execution: {
      mode: "Render Workflows",
      id: result.id,
      status: result.status,
      fallback: false,
      modelFallback: payload.modelEvidence.model?.status === "unavailable",
      evidenceSource:
        payload.modelEvidence.model?.status === "unavailable"
          ? "deterministic rules"
          : "Python model",
      workflow: result.taskSlug || null,
      sourceCommit: payload.workflowProvenance?.commit || null,
      sourceBranch: payload.workflowProvenance?.branch || null,
    },
  };
}

export function createAnalysisRunner({
  runWorkflow,
  scoreModel = scoreWithRelay,
  deterministic = analyze,
  env = process.env,
  id = randomUUID,
} = {}) {
  return async function runAnalysis({
    events,
    context = null,
    program = "post_abdominal_surgery",
    patientId,
    requireSynthetic = false,
    dataType = "synthetic",
  }) {
    if (requireSynthetic && dataType !== "synthetic")
      throw new Error(
        "Cloud workflows are restricted to synthetic records in this prototype.",
      );
    const input = { events, context, program, patientId };
    if (env.RENDER_API_KEY && env.RENDER_WORKFLOW_SLUG) {
      try {
        const execute =
          runWorkflow ||
          (async (taskInput) => {
            const { Render } = await import("@renderinc/sdk");
            return new Render().workflows.runTask(
              `${env.RENDER_WORKFLOW_SLUG}/monitoringPipeline`,
              [taskInput],
              AbortSignal.timeout(300000),
            );
          });
        return mapWorkflowResult(await execute(input));
      } catch (error) {
        console.warn(
          `Render Workflow unavailable; using labelled fallback: ${error.message}`,
        );
        const fallback = await localFallback(input, {
          scoreModel,
          deterministic,
          env,
          id,
        });
        fallback.execution.workflowStatus = "unavailable";
        fallback.execution.fallbackReason = "workflow_unavailable";
        return fallback;
      }
    }
    return localFallback(input, {
      scoreModel,
      deterministic,
      env,
      id,
      workflowStatus: "not_configured",
    });
  };
}

async function localFallback(
  input,
  { scoreModel, deterministic, env, id, workflowStatus },
) {
  if (env.RELAY_ML_ENABLED === "true") {
    try {
      const evidence = await scoreModel(input);
      const deterministicEvidence = safeDeterministic(input, deterministic);
      return {
        evidence,
        deterministicEvidence,
        comparison: compare(evidence, deterministicEvidence),
        execution: {
          mode: "Web service Python fallback",
          id: id(),
          fallback: true,
          workflowStatus: workflowStatus || "unavailable",
        },
      };
    } catch (error) {
      console.warn(
        `Python scorer unavailable; using labelled rules fallback: ${error.message}`,
      );
    }
  }
  const rules = safeDeterministic(input, deterministic);
  const mapped = {
    ...rules,
    application_state: states[rules.state] || "insufficient_data",
    anomaly_score: null,
    model: { status: "unavailable" },
  };
  return {
    evidence: mapped,
    deterministicEvidence: rules,
    comparison: compare(mapped, rules),
    execution: {
      mode: "Local rules fallback",
      id: id(),
      fallback: true,
      workflowStatus: workflowStatus || "unavailable",
    },
  };
}

function safeDeterministic(input, deterministic) {
  const supported = input.events.filter((event) =>
    Object.hasOwn(METRICS, event.metric),
  );
  if (!supported.length)
    return {
      state: "context",
      signals: [],
      summary: "The rules review could not evaluate these reading types.",
      unsupportedMetrics: [
        ...new Set(input.events.map((event) => event.metric)),
      ],
    };
  return deterministic(supported, input.context);
}

function compare(model, rules) {
  const modelMetrics = new Set(
    (model?.signals || []).map((signal) => signal.metric),
  );
  const ruleMetrics = new Set(
    (rules?.signals || []).map((signal) => signal.metric),
  );
  return {
    modelState: model?.application_state || null,
    rulesState: states[rules?.state] || null,
    statesAgree:
      model?.application_state && states[rules?.state]
        ? model.application_state === states[rules.state]
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
  };
}

import { METRIC_MAP } from "../model/mlClient.js";
import {
  PROFILES,
  QUESTIONS,
  QUESTION_SIGNAL_MAP,
  SIGNALS,
} from "../model/profiles.js";

const CONTEXT_ONLY = new Set(["activity", "medicine"]);
const CHANGE_STATES = new Set(["context_needed", "review_recommended"]);

function contributorSignals(analysis) {
  const contributors = analysis?.contributors || [];
  return [
    ...new Set(
      contributors.flatMap((contributor) => {
        const metric = String(contributor.metric || "").toLowerCase();
        const label = String(contributor.label || "").toLowerCase();
        return Object.entries(SIGNALS).flatMap(([id, signal]) => {
          const modelMetric = METRIC_MAP[id]?.[0];
          return (modelMetric && metric === modelMetric) ||
            label.includes(signal.plain.toLowerCase()) ||
            label.includes(signal.short.toLowerCase())
            ? [id]
            : [];
        });
      }),
    ),
  ];
}

function signalOrder(patient, analysis) {
  const fromModel = contributorSignals(analysis);
  if (fromModel.length) return fromModel;
  return (patient.counted || [])
    .filter((signal) => signal.moved)
    .map((signal) => signal.id);
}

function selectRelevantSymptoms(ranked, links, signals, limit) {
  const remaining = new Set(signals);
  const selected = [];
  while (selected.length < limit) {
    const candidate = ranked
      .filter(({ id }) => !CONTEXT_ONLY.has(id) && !selected.includes(id))
      .map((question) => ({
        ...question,
        relevance: (links[question.id] || []).reduce(
          (score, signal) =>
            score +
            (remaining.has(signal)
              ? Math.max(1, signals.length - signals.indexOf(signal))
              : 0),
          0,
        ),
      }))
      .filter((question) => question.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || a.index - b.index)[0];
    if (!candidate) break;
    selected.push(candidate.id);
    for (const signal of links[candidate.id] || []) remaining.delete(signal);
  }
  return selected;
}

function promptFor(patient, focusSignals, mode) {
  if (patient.profile?.ml === "stroke_rehabilitation")
    return "Anything else about your recovery or rehab routine your care team should know? You can say no.";
  if (mode === "routine")
    return "What have you done today? Were meals, drinks, or activity different? You can say no.";
  if (mode === "insufficient")
    return "Anything else about how you feel or your recovery that you want to share? You can say no.";

  const names = focusSignals
    .map((id) => SIGNALS[id]?.plain?.toLowerCase())
    .filter(Boolean);
  const respiratory = names.some(
    (name) => name.includes("breathing") || name.includes("oxygen"),
  );
  const cardiac = names.some(
    (name) => name.includes("heart") || name.includes("weight"),
  );
  const sleep = names.some((name) => name.includes("sleep"));
  if (respiratory)
    return "Around then, were your activity, meals, or drinks different? You can say no.";
  if (cardiac)
    return "Around then, were your activity, meals, or drinks different? You can say no.";
  if (sleep)
    return "Around then, were your sleep, activity, meals, or drinks different? You can say no.";
  return "Around then, was your routine different? You can say no.";
}

function planQuestionFor(profileId, allowed) {
  const preferred =
    profileId === "strokeRehabilitation"
      ? ["mealPlan", "medicine", "activity"]
      : ["medicine", "activity"];
  return preferred.find((id) => allowed.includes(id));
}

// Stay within the discharge profile; wearable findings only prioritize relevant
// questions and never create a diagnosis or imply that a finding caused a symptom.
export function buildCheckinPlan(patient, analysis = patient.analysis) {
  const profileId = patient.profileId || patient.profile;
  const profile =
    typeof patient.profile === "object" ? patient.profile : PROFILES[profileId];
  // When a fresh model result is supplied, use the discharge plan's canonical
  // order as the tie-breaker. The derived patient.questions list may already
  // have been reordered by wearable rules and would mask the model's ranking.
  const questionSource = analysis
    ? profile?.questions || patient.questions
    : patient.questions || profile?.questions;
  const allowed = (questionSource || []).filter((id) => QUESTIONS[id]);
  const links = QUESTION_SIGNAL_MAP[profileId] || {};
  const signals = signalOrder(patient, analysis);
  const ranked = allowed
    .map((id, index) => ({
      id,
      index,
      score: (links[id] || []).filter((signal) => signals.includes(signal))
        .length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const hasChange =
    CHANGE_STATES.has(analysis?.application_state) ||
    !!analysis?.is_anomalous ||
    !!patient.pattern;
  const insufficient = analysis?.application_state === "insufficient_data";
  const mode = hasChange ? "change" : insufficient ? "insufficient" : "routine";
  const priority =
    hasChange ||
    !!analysis?.is_anomalous ||
    analysis?.application_state === "review_recommended";

  let selected = [];
  if (hasChange) {
    selected = selectRelevantSymptoms(ranked, links, signals, 2);
    if (!selected.length) {
      const firstSymptom = ranked.find(({ id }) => !CONTEXT_ONLY.has(id));
      if (firstSymptom) selected.push(firstSymptom.id);
    }
    // Finish with one discharge-plan check rather than stacking medicine and
    // activity prompts on top of several symptoms.
    const planQuestion = planQuestionFor(profileId, allowed);
    if (planQuestion && selected.length < 3) selected.push(planQuestion);
  } else {
    // Routine follow-up stays short: one symptom from this discharge plan and
    // one check on the plan itself. The optional context question comes after.
    const firstSymptom = ranked.find(({ id }) => !CONTEXT_ONLY.has(id));
    if (firstSymptom) selected.push(firstSymptom.id);
    const planQuestion = planQuestionFor(profileId, allowed);
    if (planQuestion && selected.length < 2) selected.push(planQuestion);
  }
  return {
    mode,
    priority,
    questions: selected,
    focusSignals: [...signals],
    findingSummary: findingSummary(patient, analysis, signals),
    contextPrompt: promptFor({ ...patient, profile }, [...signals], mode),
  };
}

function findingSummary(patient, analysis, focusSignals) {
  if (!focusSignals.length) return "";
  const readings = (patient.counted || [])
    .filter((signal) => focusSignals.includes(signal.id) && signal.moved)
    .slice(0, 3)
    .map((signal) => {
      const direction = signal.watchDir > 0 ? "higher" : "lower";
      const duration = signal.towardDays
        ? ` for about ${signal.towardDays} ${signal.towardDays === 1 ? "day" : "days"}`
        : "";
      return `${signal.plain.toLowerCase()} ${direction} than your usual${duration}`;
    });
  if (readings.length) return readings.join(", ");

  return (analysis?.contributors || [])
    .slice(0, 3)
    .map((item) => {
      const direction =
        item.direction === "above_baseline" ? "higher" : "lower";
      return `${String(item.label || item.metric || "a reading").toLowerCase()} ${direction} than your usual`;
    })
    .join(", ");
}

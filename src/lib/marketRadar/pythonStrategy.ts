import type {
  ObservationWithMapping,
  PythonStrategyContext,
  PythonStrategyResult,
  StrategyRecipe,
  TxlineReferenceByOutcome,
  UserBeliefByMapping,
} from "./types";

export const PYTHON_STRATEGY_LIMITS = {
  defaultTimeoutMs: 2_000,
  maximumTimeoutMs: 5_000,
  maximumSourceBytes: 64 * 1024,
  maximumObservations: 200,
  maximumInputBytes: 1024 * 1024,
  maximumCombinedOutputBytes: 256 * 1024,
};

export function buildPythonStrategyContext({
  selectedObservation,
  observations,
  userBeliefs = {},
  txlineReference = {},
  selectedStrategyParameters,
  runMode,
  now = new Date().toISOString(),
}: {
  selectedObservation: ObservationWithMapping | null;
  observations: ObservationWithMapping[];
  userBeliefs?: UserBeliefByMapping;
  txlineReference?: TxlineReferenceByOutcome;
  selectedStrategyParameters: StrategyRecipe;
  runMode: PythonStrategyContext["runMode"];
  now?: string;
}): PythonStrategyContext {
  const boundedObservations =
    runMode === "filtered-batch" ? observations.slice(0, PYTHON_STRATEGY_LIMITS.maximumObservations) : selectedObservation ? [selectedObservation] : [];
  const mapping = selectedObservation?.mapping ?? null;
  return freezeJson({
    selectedObservation,
    observations: boundedObservations,
    selectedMapping: mapping,
    userProbability: mapping ? userBeliefs[mapping.id] ?? null : null,
    txlineReference,
    selectedStrategyParameters,
    evaluationTimestamp: now,
    runMode,
  });
}

export function validatePythonStrategyRunInput({
  source,
  context,
}: {
  source: string;
  context: PythonStrategyContext;
}): void {
  if (byteLength(source) > PYTHON_STRATEGY_LIMITS.maximumSourceBytes) {
    throw new Error("Python source exceeds the 64 KB limit.");
  }
  if (context.observations.length > PYTHON_STRATEGY_LIMITS.maximumObservations) {
    throw new Error("Python context exceeds the 200 observation limit.");
  }
  if (byteLength(JSON.stringify(context)) > PYTHON_STRATEGY_LIMITS.maximumInputBytes) {
    throw new Error("Python context exceeds the 1 MB input limit.");
  }
}

export function validatePythonStrategyResult(value: unknown): PythonStrategyResult {
  if (!isRecord(value)) {
    throw new Error("Python strategy must return a JSON object.");
  }
  if (!["accept", "reject", "context-only"].includes(String(value.decision))) {
    throw new Error("Python strategy decision must be accept, reject, or context-only.");
  }
  if (value.score !== null && (typeof value.score !== "number" || !Number.isFinite(value.score))) {
    throw new Error("Python strategy score must be a finite number or null.");
  }
  if (!Array.isArray(value.reasons) || value.reasons.some((reason) => typeof reason !== "string")) {
    throw new Error("Python strategy reasons must be an array of strings.");
  }
  if (!isRecord(value.metrics) || Object.values(value.metrics).some((metric) => !isMetric(metric))) {
    throw new Error("Python strategy metrics must contain only number, string, boolean, or null values.");
  }
  assertOptionalNumber(value.proposedMinimumOdds, "proposedMinimumOdds");
  assertOptionalNumber(value.proposedStake, "proposedStake");

  return {
    decision: value.decision as PythonStrategyResult["decision"],
    score: value.score as number | null,
    reasons: value.reasons.slice(0, 20),
    metrics: value.metrics as PythonStrategyResult["metrics"],
    proposedMinimumOdds: value.proposedMinimumOdds as number | null | undefined,
    proposedStake: value.proposedStake as number | null | undefined,
  };
}

export function enforcePythonAdvisoryRouteGate({
  result,
  selectedObservation,
}: {
  result: PythonStrategyResult;
  selectedObservation: ObservationWithMapping | null;
}): PythonStrategyResult {
  if (result.decision !== "accept" || selectedObservation?.mapping?.equivalence === "settlement-exact") {
    return result;
  }
  return {
    ...result,
    decision: "context-only",
    proposedStake: null,
    reasons: [
      ...result.reasons,
      "Python output is advisory: only a settlement-exact mapped observation that separately passes TypeScript route gates may be pinned.",
    ],
  };
}

function assertOptionalNumber(value: unknown, field: string) {
  if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`Python strategy ${field} must be a finite number, null, or omitted.`);
  }
}

function isMetric(value: unknown): boolean {
  return value === null || ["number", "string", "boolean"].includes(typeof value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function freezeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

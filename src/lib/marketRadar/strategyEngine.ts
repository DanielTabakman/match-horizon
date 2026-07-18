import type {
  InterestingnessScore,
  ObservationWithMapping,
  StrategyEvaluation,
  StrategyRecipe,
  ThresholdCalculation,
  TxlineReferenceByOutcome,
  UserBeliefByMapping,
} from "./types";

export const BUILT_IN_RECIPES: StrategyRecipe[] = [
  recipe("stale-market", "Stale Market", "txline", 0.08, 0.08, 5, 10, 0.08, "half-kelly", 1000, true),
  recipe("consensus-outlier", "Consensus Outlier", "cross-venue-consensus", 0.06, 0.12, 5, 30, 0.06, "fixed", 500, true),
  recipe("liquidity-sweep", "Liquidity Sweep", "user-belief", 0.04, 0.15, 25, 30, null, "liquidity-fraction", 750, true),
  recipe("belief-confirmation", "Belief Confirmation", "user-belief", 0.03, 0.18, 5, 60, null, "quarter-kelly", 500, true),
  recipe("contrarian-tail", "Contrarian Tail", "cross-venue-consensus", 0.02, 0.2, 5, 120, null, "fixed", 250, false),
];

export const DEFAULT_CUSTOM_RECIPE: StrategyRecipe = recipe(
  "custom",
  "Custom Recipe",
  "user-belief",
  0.05,
  0.12,
  10,
  30,
  null,
  "fixed",
  500,
  true,
);

export function scoreObservation({
  observation,
  observations,
  userBeliefs = {},
  now = Date.now(),
}: {
  observation: ObservationWithMapping;
  observations: ObservationWithMapping[];
  userBeliefs?: UserBeliefByMapping;
  now?: number;
}): InterestingnessScore {
  const depth = (observation.availableAskSize ?? 0) + (observation.availableBidSize ?? 0);
  const probability = marketProbability(observation);
  const consensus = consensusProbability(observation, observations);
  const belief = observation.mapping ? userBeliefs[observation.mapping.id] : undefined;
  const breakdown = {
    liquidity: clamp(depth / 200, 0, 1),
    spread: observation.spreadProbability === null ? 0.15 : clamp(1 - observation.spreadProbability / 0.25, 0, 1),
    freshness: clamp(1 - Math.max(0, now - Date.parse(observation.observedAt)) / 7_200_000, 0, 1),
    extremeness: probability === null ? 0 : clamp(Math.abs(probability - 0.5) * 2, 0, 1),
    crossVenueDivergence: probability === null || consensus === null ? 0 : clamp(Math.abs(probability - consensus) / 0.25, 0, 1),
    beliefDisagreement: probability === null || belief === undefined ? 0 : clamp(Math.abs(belief - probability) / 0.25, 0, 1),
    resolutionRiskPenalty: observation.mapping?.equivalence === "exact" ? 0 : observation.mapping ? 0.15 : 0.3,
  };
  const total = clamp(
    breakdown.liquidity * 18 +
      breakdown.spread * 18 +
      breakdown.freshness * 14 +
      breakdown.extremeness * 14 +
      breakdown.crossVenueDivergence * 18 +
      breakdown.beliefDisagreement * 18 -
      breakdown.resolutionRiskPenalty * 100,
    0,
    100,
  );

  return { total: round(total), breakdown };
}

export function evaluateRecipe({
  recipe,
  observation,
  observations,
  userBeliefs = {},
  txlineReference = {},
  now = Date.now(),
}: {
  recipe: StrategyRecipe;
  observation: ObservationWithMapping;
  observations: ObservationWithMapping[];
  userBeliefs?: UserBeliefByMapping;
  txlineReference?: TxlineReferenceByOutcome;
  now?: number;
}): StrategyEvaluation {
  const acceptedReasons: string[] = [];
  const rejectedReasons: string[] = [];
  const contextOnlyReasons: string[] = [];
  const probability = executableProbability(observation);
  const referenceProbability = referenceFor(recipe, observation, observations, userBeliefs, txlineReference);
  const depth = Math.max(observation.availableAskSize ?? 0, observation.availableBidSize ?? 0);
  const ageMs = Math.max(0, now - Date.parse(observation.observedAt));
  const edge = probability !== null && referenceProbability !== null ? referenceProbability - probability : null;

  if (!observation.mapping) {
    contextOnlyReasons.push("context-only because mapping is missing and no equivalence is claimed.");
  } else if (observation.mapping.equivalence !== "exact") {
    contextOnlyReasons.push(`context-only because mapping ${observation.mapping.id} is ${observation.mapping.equivalence}, not exact.`);
  }

  if (recipe.requireExplicitMapping && observation.mapping?.equivalence !== "exact") {
    rejectedReasons.push("rejected because this recipe requires an exact mapping before paper routing.");
  }
  if (probability === null) {
    rejectedReasons.push("rejected because no usable ask or midpoint probability is available.");
  }
  if (referenceProbability === null) {
    rejectedReasons.push(`rejected because the ${recipe.reference} reference is unavailable.`);
  }
  if (edge !== null && edge < recipe.minimumEdge) {
    rejectedReasons.push(`rejected because edge ${fmtPct(edge)} is below ${fmtPct(recipe.minimumEdge)}.`);
  } else if (edge !== null) {
    acceptedReasons.push(`accepted because edge ${fmtPct(edge)} meets ${fmtPct(recipe.minimumEdge)}.`);
  }
  if (recipe.maximumSpread !== null && observation.spreadProbability !== null && observation.spreadProbability > recipe.maximumSpread) {
    rejectedReasons.push(`rejected because spread ${fmtPct(observation.spreadProbability)} exceeds ${fmtPct(recipe.maximumSpread)}.`);
  } else if (recipe.maximumSpread !== null && observation.spreadProbability !== null) {
    acceptedReasons.push(`accepted because spread ${fmtPct(observation.spreadProbability)} is within the gate.`);
  }
  if (recipe.minimumDepth !== null && depth < recipe.minimumDepth) {
    rejectedReasons.push(`rejected because depth ${depth.toFixed(1)} is below ${recipe.minimumDepth.toFixed(1)}.`);
  } else if (recipe.minimumDepth !== null) {
    acceptedReasons.push(`accepted because depth ${depth.toFixed(1)} meets the requirement.`);
  }
  if (recipe.maximumAgeMs !== null && ageMs > recipe.maximumAgeMs) {
    rejectedReasons.push(`rejected because quote age ${fmtAge(ageMs)} exceeds ${fmtAge(recipe.maximumAgeMs)}.`);
  } else if (recipe.maximumAgeMs !== null) {
    acceptedReasons.push(`accepted because quote age ${fmtAge(ageMs)} is fresh enough.`);
  }
  if (recipe.divergenceThreshold !== null) {
    const consensus = consensusProbability(observation, observations);
    const divergence = probability !== null && consensus !== null ? Math.abs(probability - consensus) : null;
    if (divergence === null) {
      rejectedReasons.push("rejected because cross-venue divergence cannot be calculated.");
    } else if (divergence < recipe.divergenceThreshold) {
      rejectedReasons.push(`rejected because divergence ${fmtPct(divergence)} is below ${fmtPct(recipe.divergenceThreshold)}.`);
    } else {
      acceptedReasons.push(`accepted because divergence ${fmtPct(divergence)} clears the outlier threshold.`);
    }
  }
  if (recipe.id === "belief-confirmation") {
    const consensus = consensusProbability(observation, observations);
    const belief = observation.mapping ? userBeliefs[observation.mapping.id] : undefined;
    if (belief === undefined || consensus === null || probability === null || !(belief > probability && consensus > probability)) {
      rejectedReasons.push("rejected because user belief and independent market consensus do not both point above the venue price.");
    } else {
      acceptedReasons.push("accepted because user belief and cross-venue consensus both point above this venue.");
    }
  }
  if (recipe.id === "contrarian-tail" && (probability === null || probability > 0.25)) {
    rejectedReasons.push("rejected because Contrarian Tail only highlights outcomes at 25% probability or lower.");
  }

  const verdict = contextOnlyReasons.length > 0 ? "context-only" : rejectedReasons.length > 0 ? "rejected" : "accepted";
  return {
    recipeId: recipe.id,
    recipeLabel: recipe.label,
    verdict,
    acceptedReasons,
    rejectedReasons,
    contextOnlyReasons,
    referenceProbability,
    edge,
    stake: verdict === "accepted" ? stakeFor(recipe, depth, edge) : null,
  };
}

export function duelRecipes(input: {
  left: StrategyRecipe;
  right: StrategyRecipe;
  observation: ObservationWithMapping;
  observations: ObservationWithMapping[];
  userBeliefs?: UserBeliefByMapping;
  txlineReference?: TxlineReferenceByOutcome;
  now?: number;
}) {
  const left = evaluateRecipe({ ...input, recipe: input.left });
  const right = evaluateRecipe({ ...input, recipe: input.right });
  return {
    left,
    right,
    summary:
      left.verdict === right.verdict
        ? `${left.recipeLabel} and ${right.recipeLabel} both ${left.verdict.replace("-", " ")}.`
        : `${left.recipeLabel} ${left.verdict.replace("-", " ")} while ${right.recipeLabel} ${right.verdict.replace("-", " ")}.`,
  };
}

export function calculateChangeMyMindThreshold({
  recipe,
  observation,
  referenceProbability,
}: {
  recipe: StrategyRecipe;
  observation: ObservationWithMapping;
  referenceProbability: number | null;
}): ThresholdCalculation {
  const currentAskProbability = executableProbability(observation);
  const thresholdProbability = referenceProbability === null ? null : Math.max(0.0001, referenceProbability - recipe.minimumEdge);
  const thresholdDecimalOdds = thresholdProbability === null ? null : round(1 / thresholdProbability);
  return {
    currentAskProbability,
    currentAskDecimalOdds: currentAskProbability === null ? null : round(1 / currentAskProbability),
    thresholdProbability,
    thresholdDecimalOdds,
    explanation:
      thresholdProbability === null
        ? "A threshold needs a user, TxLINE, or consensus reference probability."
        : `This recipe stops passing when market probability rises above ${fmtPct(thresholdProbability)}, equivalent to decimal odds below ${thresholdDecimalOdds?.toFixed(2)}.`,
  };
}

function recipe(
  id: string,
  label: string,
  reference: StrategyRecipe["reference"],
  minimumEdge: number,
  maximumSpread: number | null,
  minimumDepth: number | null,
  maximumAgeMinutes: number | null,
  divergenceThreshold: number | null,
  sizing: StrategyRecipe["sizing"],
  stakeCap: number | null,
  requireExplicitMapping: boolean,
): StrategyRecipe {
  return {
    id,
    label,
    reference,
    minimumEdge,
    maximumSpread,
    minimumDepth,
    maximumAgeMs: maximumAgeMinutes === null ? null : maximumAgeMinutes * 60_000,
    divergenceThreshold,
    sizing,
    stakeCap,
    requireExplicitMapping,
  };
}

function referenceFor(
  recipe: StrategyRecipe,
  observation: ObservationWithMapping,
  observations: ObservationWithMapping[],
  userBeliefs: UserBeliefByMapping,
  txlineReference: TxlineReferenceByOutcome,
): number | null {
  if (recipe.reference === "cross-venue-consensus") {
    return consensusProbability(observation, observations);
  }
  if (recipe.reference === "user-belief") {
    return observation.mapping ? userBeliefs[observation.mapping.id] ?? null : null;
  }
  return observation.mapping?.txlineOutcomeId ? txlineReference[observation.mapping.txlineOutcomeId] ?? null : null;
}

function executableProbability(observation: ObservationWithMapping): number | null {
  return observation.bestAskProbability ?? observation.midpointProbability;
}

function marketProbability(observation: ObservationWithMapping): number | null {
  return observation.midpointProbability ?? observation.bestAskProbability ?? observation.bestBidProbability ?? observation.lastTradeProbability;
}

function consensusProbability(observation: ObservationWithMapping, observations: ObservationWithMapping[]): number | null {
  const values = observations
    .filter(
      (candidate) =>
        candidate.externalOutcomeId !== observation.externalOutcomeId &&
        candidate.outcomeLabel.toLowerCase() === observation.outcomeLabel.toLowerCase(),
    )
    .map(marketProbability)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  return values.length === 0 ? null : values[Math.floor(values.length / 2)];
}

function stakeFor(recipe: StrategyRecipe, depth: number, edge: number | null): number | null {
  const cap = recipe.stakeCap ?? depth;
  if (recipe.sizing === "liquidity-fraction") return round(Math.min(cap, depth * 0.25));
  if (recipe.sizing === "fixed") return round(Math.min(cap, depth));
  const multiplier = recipe.sizing === "quarter-kelly" ? 0.25 : recipe.sizing === "half-kelly" ? 0.5 : 1;
  return round(Math.min(cap, Math.max(0, edge ?? 0) * multiplier * 10_000));
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtAge(value: number): string {
  return `${Math.round(value / 60_000)}m`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

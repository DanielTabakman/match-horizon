import type {
  ObservationRouteState,
  ObservationWithMapping,
  PaperEligibilityResult,
  ProvenancedGenericQuote,
  StrategyEvaluation,
  StrategyRecipe,
} from "./types";

export function evaluatePaperEligibility({
  observation,
  evaluation,
  recipe,
  now,
}: {
  observation: ObservationWithMapping;
  evaluation: StrategyEvaluation | null;
  recipe: StrategyRecipe;
  now: number;
}): PaperEligibilityResult {
  const reasons: string[] = [];
  const ask = observation.bestAskProbability;
  const askDepth = observation.availableAskSize;
  const ageMs = Math.max(0, now - Date.parse(observation.observedAt));

  if (observation.mapping?.equivalence !== "exact" || !observation.mapping.canonicalSelectionId) {
    reasons.push("requires exact audited canonical mapping");
  }
  if (ask === null || ask <= 0 || ask > 1) {
    reasons.push("requires a valid executable ask probability");
  }
  if (askDepth === null || askDepth <= 0) {
    reasons.push("requires executable ask depth in USD/USDC notional");
  }
  if (recipe.maximumAgeMs !== null && ageMs > recipe.maximumAgeMs) {
    reasons.push("requires a fresh observation within the selected recipe age gate");
  }
  if (recipe.minimumDepth !== null && (askDepth ?? 0) < recipe.minimumDepth) {
    reasons.push("requires normalized executable ask depth above the selected recipe minimum");
  }
  if (recipe.maximumSpread !== null && (observation.spreadProbability === null || observation.spreadProbability > recipe.maximumSpread)) {
    reasons.push("requires an available spread within the selected recipe maximum");
  }
  if (evaluation?.verdict !== "accepted") {
    reasons.push("requires the selected TypeScript strategy evaluation to accept");
  }

  return { eligible: reasons.length === 0, reasons };
}

export function effectiveObservationRouteState({
  observation,
  eligibility,
}: {
  observation: ObservationWithMapping;
  eligibility: PaperEligibilityResult;
}): ObservationRouteState {
  if (eligibility.eligible) {
    return "paper-executable";
  }
  return observation.mapping ? "mapped" : "context-only";
}

export function buildMappedObservationPaperQuote({
  observation,
  eligibility,
  availableStake,
  sourceStatus = "live",
}: {
  observation: ObservationWithMapping;
  eligibility: PaperEligibilityResult;
  availableStake?: number | null;
  sourceStatus?: "live" | "captured";
}): ProvenancedGenericQuote | null {
  if (!eligibility.eligible || observation.mapping?.equivalence !== "exact" || !observation.mapping.canonicalSelectionId) {
    return null;
  }

  const probability = observation.bestAskProbability;
  const size = availableStake ?? observation.availableAskSize;
  if (probability === null || probability <= 0 || probability > 1 || size === null || size <= 0) {
    return null;
  }

  return {
    quoteId: `external:${observation.venueId}:${observation.externalMarketId}:${observation.externalOutcomeId}`,
    venueId: observation.venueId,
    venueLabel: observation.venueLabel,
    selectionId: observation.mapping.canonicalSelectionId,
    decimalOdds: 1 / probability,
    availableStake: size,
    provenance: {
      venueId: observation.venueId,
      venueLabel: observation.venueLabel,
      externalMarketId: observation.externalMarketId,
      externalOutcomeId: observation.externalOutcomeId,
      observedAt: observation.observedAt,
      mappingId: observation.mapping.id,
      canonicalSelectionId: observation.mapping.canonicalSelectionId,
      sourceUrl: observation.sourceUrl,
      status: sourceStatus,
    },
  };
}

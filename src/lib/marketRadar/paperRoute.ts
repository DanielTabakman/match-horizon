import type { OutcomeQuote } from "../domain";
import type { ObservationWithMapping, PaperEligibilityResult, ProvenancedSimulatedQuote, StrategyEvaluation, StrategyRecipe } from "./types";

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

  if (observation.mapping?.equivalence !== "exact" || !observation.mapping.txlineOutcomeId) {
    reasons.push("requires exact audited mapping to a TxLINE fixture outcome");
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

export function buildMappedObservationPaperQuote({
  observation,
  eligibility,
  availableStake,
}: {
  observation: ObservationWithMapping;
  eligibility: PaperEligibilityResult;
  availableStake?: number | null;
}): ProvenancedSimulatedQuote | null {
  if (!eligibility.eligible || observation.mapping?.equivalence !== "exact" || !observation.mapping.txlineOutcomeId) {
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
    outcomeId: observation.mapping.txlineOutcomeId as OutcomeQuote["outcomeId"],
    decimalOdds: Math.round((1 / probability) * 1000) / 1000,
    availableStake: size,
    provenance: {
      venueId: observation.venueId,
      venueLabel: observation.venueLabel,
      externalMarketId: observation.externalMarketId,
      externalOutcomeId: observation.externalOutcomeId,
      observedAt: observation.observedAt,
      mappingId: observation.mapping.id,
    },
  };
}

import type { OutcomeQuote } from "../domain";
import type { ObservationWithMapping, ProvenancedSimulatedQuote } from "./types";

export function buildMappedObservationPaperQuote({
  observation,
  availableStake,
}: {
  observation: ObservationWithMapping;
  availableStake?: number | null;
}): ProvenancedSimulatedQuote | null {
  if (observation.mapping?.equivalence !== "exact" || !observation.mapping.txlineOutcomeId) {
    return null;
  }

  const probability = observation.bestAskProbability ?? observation.midpointProbability;
  const size = availableStake ?? observation.availableAskSize ?? observation.availableBidSize;
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

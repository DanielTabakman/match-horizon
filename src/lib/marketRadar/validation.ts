import type { ExternalMarketObservation, MarketMapping } from "./types";

export function validateObservation(observation: ExternalMarketObservation): ExternalMarketObservation {
  for (const field of [
    "venueId",
    "venueLabel",
    "externalMarketId",
    "externalOutcomeId",
    "title",
    "outcomeLabel",
    "observedAt",
    "rawStatus",
  ] as const) {
    if (!observation[field]) {
      throw new Error(`ExternalMarketObservation.${field} is required.`);
    }
  }

  for (const field of [
    "bestBidProbability",
    "bestAskProbability",
    "midpointProbability",
    "spreadProbability",
    "lastTradeProbability",
  ] as const) {
    const value = observation[field];
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error(`ExternalMarketObservation.${field} must be null or a probability from 0 to 1.`);
    }
  }

  for (const field of ["availableBidSize", "availableAskSize"] as const) {
    const value = observation[field];
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`ExternalMarketObservation.${field} must be null or non-negative.`);
    }
  }

  assertIso(observation.startsAt, "startsAt");
  assertIso(observation.closesAt, "closesAt");
  assertIso(observation.observedAt, "observedAt");
  return observation;
}

export function validateMapping(mapping: MarketMapping): MarketMapping {
  if (!mapping.id || !mapping.venueId || !mapping.externalMarketId || !mapping.externalOutcomeId) {
    throw new Error("MarketMapping must include ids for the mapping, venue, market, and outcome.");
  }

  if (!["exact", "related", "not-equivalent"].includes(mapping.equivalence)) {
    throw new Error(`Unsupported market mapping equivalence: ${mapping.equivalence}`);
  }

  if (mapping.equivalence === "exact" && (!mapping.txlineFixtureId || !mapping.txlineOutcomeId)) {
    throw new Error("Exact MarketMapping requires TxLINE fixture and outcome ids.");
  }

  if (!mapping.resolutionNotes) {
    throw new Error("MarketMapping.resolutionNotes is required.");
  }

  assertIso(mapping.reviewedAt, "reviewedAt");
  return mapping;
}

function assertIso(value: string | null, field: string) {
  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be null or an ISO timestamp.`);
  }
}

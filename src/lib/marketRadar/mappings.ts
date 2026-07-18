import { validateMapping } from "./validation";
import type { ExternalMarketObservation, MarketMapping, ObservationWithMapping } from "./types";

export const MARKET_MAPPINGS: MarketMapping[] = [
  {
    id: "sx-world-cup-2026-spain-outright-related",
    txlineFixtureId: "18237038",
    txlineOutcomeId: "participant_2",
    venueId: "sx-bet",
    externalMarketId: "0xd3fa7bceaaccd813858b5b7ff33a2fba93cc7f05a583883719b9367cc94c10f4",
    externalOutcomeId: "outcome-one",
    normalizedOutcomeLabel: "Spain wins World Cup outright",
    equivalence: "related",
    resolutionNotes:
      "Related only: SX Bet World Cup outright is tournament-winner exposure, not the France-Spain fixture result.",
    reviewedAt: "2026-07-18T00:00:00.000Z",
  },
];

export function mapObservation(observation: ExternalMarketObservation): ObservationWithMapping {
  const mapping =
    MARKET_MAPPINGS.map(validateMapping).find(
      (candidate) =>
        candidate.venueId === observation.venueId &&
        candidate.externalMarketId === observation.externalMarketId &&
        candidate.externalOutcomeId === observation.externalOutcomeId,
    ) ?? null;
  const routeState = mapping ? "mapped" : "context-only";
  return { ...observation, mapping, routeState };
}

export function mapObservations(observations: ExternalMarketObservation[]): ObservationWithMapping[] {
  return observations.map(mapObservation);
}

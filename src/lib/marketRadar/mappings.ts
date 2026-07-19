import { validateMapping } from "./validation";
import type { ExternalMarketObservation, MarketMapping, ObservationWithMapping } from "./types";

export const MARKET_MAPPINGS: MarketMapping[] = [
  {
    id: "sx-world-cup-2026-spain-outright-related",
    canonicalSelectionId: null,
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
  {
    id: "sx-world-cup-2026-argentina-outright-exact",
    canonicalSelectionId: "fifa-world-cup-2026-winner:argentina",
    txlineFixtureId: null,
    txlineOutcomeId: null,
    venueId: "sx-bet",
    externalMarketId: "0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1",
    externalOutcomeId: "outcome-one",
    normalizedOutcomeLabel: "Argentina wins 2026 FIFA World Cup",
    equivalence: "exact",
    resolutionNotes:
      "Exact cross-venue group: Argentina to win the 2026 FIFA/Men's World Cup outright. Not mapped to the France-Spain fixture.",
    reviewedAt: "2026-07-19T03:00:00.000Z",
  },
  {
    id: "kalshi-world-cup-2026-argentina-outright-exact",
    canonicalSelectionId: "fifa-world-cup-2026-winner:argentina",
    txlineFixtureId: null,
    txlineOutcomeId: null,
    venueId: "kalshi",
    externalMarketId: "KXMENWORLDCUP-26-AR",
    externalOutcomeId: "yes",
    normalizedOutcomeLabel: "Argentina wins 2026 Men's World Cup",
    equivalence: "exact",
    resolutionNotes:
      "Exact cross-venue group: YES resolves if Argentina wins the 2026 Men's World Cup.",
    reviewedAt: "2026-07-19T03:00:00.000Z",
  },
  {
    id: "polymarket-world-cup-2026-argentina-outright-exact",
    canonicalSelectionId: "fifa-world-cup-2026-winner:argentina",
    txlineFixtureId: null,
    txlineOutcomeId: null,
    venueId: "polymarket",
    externalMarketId: "0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f",
    externalOutcomeId: "18812649149814341758733697580460697418474693998558159483117100240528657629879",
    normalizedOutcomeLabel: "Argentina wins 2026 FIFA World Cup",
    equivalence: "exact",
    resolutionNotes:
      "Exact cross-venue group: YES resolves according to the national team that wins the 2026 FIFA World Cup.",
    reviewedAt: "2026-07-19T03:00:00.000Z",
  },
  {
    id: "polymarket-world-cup-2026-argentina-no-not-equivalent",
    canonicalSelectionId: null,
    txlineFixtureId: null,
    txlineOutcomeId: null,
    venueId: "polymarket",
    externalMarketId: "0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f",
    externalOutcomeId: "115428153746996892211798999366308897078723117634059783423375188043903703749062",
    normalizedOutcomeLabel: "Argentina does not win 2026 FIFA World Cup",
    equivalence: "not-equivalent",
    resolutionNotes: "NO side is the complement of the selected Argentina-wins outcome and must not group with YES.",
    reviewedAt: "2026-07-19T03:00:00.000Z",
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

import { buildGenericExecutionRoute } from "../execution/router";
import type { GenericExecutionIntent, GenericExecutionRoute } from "../execution/router";
import type { ObservationWithMapping, ProvenancedGenericQuote } from "./types";

export const REAL_QUOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RealQuoteBuildResult =
  | { status: "ready"; quotes: ProvenancedGenericQuote[]; canonicalSelectionId: string; labels: string[] }
  | { status: "no-exact-overlap"; quotes: ProvenancedGenericQuote[]; reason: string }
  | { status: "quotes-stale"; quotes: ProvenancedGenericQuote[]; reason: string };

export function buildRealExecutableQuotes({
  observations,
  now,
  sourceStatuses,
}: {
  observations: ObservationWithMapping[];
  now: number;
  sourceStatuses?: Record<string, "live" | "captured">;
}): RealQuoteBuildResult {
  const exact = observations.filter((observation) => observation.mapping?.equivalence === "exact" && observation.mapping.canonicalSelectionId);
  const bySelection = new Map<string, ObservationWithMapping[]>();
  for (const observation of exact) {
    const selectionId = observation.mapping?.canonicalSelectionId;
    if (!selectionId) continue;
    bySelection.set(selectionId, [...(bySelection.get(selectionId) ?? []), observation]);
  }

  const group = [...bySelection.entries()]
    .map(([selectionId, groupObservations]) => ({
      selectionId,
      observations: groupObservations,
      venueCount: new Set(groupObservations.map((observation) => observation.venueId)).size,
    }))
    .sort((left, right) => right.venueCount - left.venueCount || left.selectionId.localeCompare(right.selectionId))[0];

  if (!group || group.venueCount < 2) {
    return { status: "no-exact-overlap", quotes: [], reason: "No exact cross-venue overlap with two or more venues is currently available." };
  }

  const quotes = group.observations
    .map((observation) => toRealQuote(observation, sourceStatuses?.[observation.venueId] ?? "live"))
    .filter((quote): quote is ProvenancedGenericQuote => quote !== null);
  if (quotes.length < 2 || new Set(quotes.map((quote) => quote.venueId)).size < 2) {
    return { status: "no-exact-overlap", quotes, reason: "Exact peers exist, but fewer than two have valid executable asks and capacity." };
  }

  const stale = quotes.filter((quote) => now - Date.parse(quote.provenance.observedAt) > REAL_QUOTE_MAX_AGE_MS);
  if (stale.length > 0) {
    return { status: "quotes-stale", quotes, reason: "Exact real quotes are stale; captured values are shown for evidence only." };
  }

  return {
    status: "ready",
    quotes,
    canonicalSelectionId: group.selectionId,
    labels: group.observations.map((observation) => `${observation.venueLabel}: ${observation.outcomeLabel}`),
  };
}

export function buildRealPaperRoute(
  intent: Omit<GenericExecutionIntent, "selectionId"> & { selectionId: string },
  quotes: ProvenancedGenericQuote[],
): GenericExecutionRoute {
  return buildGenericExecutionRoute(intent, quotes);
}

function toRealQuote(observation: ObservationWithMapping, sourceStatus: "live" | "captured"): ProvenancedGenericQuote | null {
  const mapping = observation.mapping;
  const probability = observation.bestAskProbability;
  const availableStake = observation.availableAskSize;
  if (
    mapping?.equivalence !== "exact" ||
    !mapping.canonicalSelectionId ||
    probability === null ||
    probability <= 0 ||
    probability > 1 ||
    availableStake === null ||
    availableStake <= 0
  ) {
    return null;
  }

  return {
    quoteId: `real:${observation.venueId}:${observation.externalMarketId}:${observation.externalOutcomeId}`,
    venueId: observation.venueId,
    venueLabel: observation.venueLabel,
    selectionId: mapping.canonicalSelectionId,
    decimalOdds: 1 / probability,
    availableStake,
    provenance: {
      venueId: observation.venueId,
      venueLabel: observation.venueLabel,
      externalMarketId: observation.externalMarketId,
      externalOutcomeId: observation.externalOutcomeId,
      observedAt: observation.observedAt,
      mappingId: mapping.id,
      canonicalSelectionId: mapping.canonicalSelectionId,
      sourceUrl: observation.sourceUrl,
      status: sourceStatus,
    },
  };
}

import { buildGenericExecutionRoute } from "../execution/router";
import type { GenericExecutionIntent, GenericExecutionRoute } from "../execution/router";
import type { ObservationWithMapping, ProvenancedGenericQuote } from "./types";

export const REAL_QUOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RealQuoteBuildResult =
  | {
      status: "ready-multi-venue";
      quotes: ProvenancedGenericQuote[];
      canonicalSelectionId: string;
      reason: string;
    }
  | {
      status: "single-venue";
      quotes: ProvenancedGenericQuote[];
      canonicalSelectionId: string;
      reason: string;
    }
  | {
      status: "no-exact-overlap";
      quotes: ProvenancedGenericQuote[];
      canonicalSelectionId: string | null;
      reason: string;
    }
  | {
      status: "quotes-stale";
      quotes: ProvenancedGenericQuote[];
      canonicalSelectionId: string;
      reason: string;
    }
  | {
      status: "captured-witness";
      quotes: ProvenancedGenericQuote[];
      canonicalSelectionId: string;
      reason: string;
    };

export function buildRealExecutableQuotes({
  observations,
  now,
  selectedCanonicalSelectionId,
  sourceStatuses,
}: {
  observations: ObservationWithMapping[];
  now: number;
  selectedCanonicalSelectionId: string | null;
  sourceStatuses?: Record<string, "live" | "captured">;
}): RealQuoteBuildResult {
  if (!selectedCanonicalSelectionId) {
    return {
      status: "no-exact-overlap",
      quotes: [],
      canonicalSelectionId: null,
      reason: "Select an exactly mapped market to compare real venues.",
    };
  }

  const group = observations.filter(
    (observation) =>
      observation.mapping?.equivalence === "exact" &&
      observation.mapping.canonicalSelectionId === selectedCanonicalSelectionId,
  );

  if (group.length === 0) {
    return {
      status: "no-exact-overlap",
      quotes: [],
      canonicalSelectionId: selectedCanonicalSelectionId,
      reason: "No exact cross-venue group exists for the selected market.",
    };
  }

  const allQuotes = group
    .map((observation) => toRealQuote(observation, sourceStatuses?.[observation.venueId] ?? "live"))
    .filter((quote): quote is ProvenancedGenericQuote => quote !== null);
  const capturedQuotes = allQuotes.filter((quote) => quote.provenance.status === "captured");
  const liveQuotes = allQuotes.filter((quote) => quote.provenance.status === "live");
  const freshLiveQuotes = liveQuotes.filter((quote) => quoteAgeMs(quote, now) <= REAL_QUOTE_MAX_AGE_MS);
  const liveVenueCount = new Set(freshLiveQuotes.map((quote) => quote.venueId)).size;

  if (liveVenueCount >= 2) {
    return {
      status: "ready-multi-venue",
      quotes: sortQuotes(freshLiveQuotes),
      canonicalSelectionId: selectedCanonicalSelectionId,
      reason: "Two or more exact live venues are available.",
    };
  }

  if (liveVenueCount === 1) {
    return {
      status: "single-venue",
      quotes: sortQuotes(freshLiveQuotes),
      canonicalSelectionId: selectedCanonicalSelectionId,
      reason: "One exact live venue is available; cross-venue routing needs at least two venues.",
    };
  }

  if (capturedQuotes.length > 0) {
    return {
      status: "captured-witness",
      quotes: sortQuotes(capturedQuotes),
      canonicalSelectionId: selectedCanonicalSelectionId,
      reason: "Captured real quotes are shown for witness replay only; they are not current live capacity.",
    };
  }

  if (liveQuotes.length > 0) {
    return {
      status: "quotes-stale",
      quotes: sortQuotes(liveQuotes),
      canonicalSelectionId: selectedCanonicalSelectionId,
      reason: "Exact live quotes are stale or invalid; refresh before building a live route.",
    };
  }

  return {
    status: "no-exact-overlap",
    quotes: [],
    canonicalSelectionId: selectedCanonicalSelectionId,
    reason: "Exact peers exist, but none have valid active executable asks and capacity.",
  };
}

export function quoteGroupSignature(result: RealQuoteBuildResult): string {
  return JSON.stringify({
    status: result.status,
    canonicalSelectionId: result.canonicalSelectionId,
    quotes: result.quotes.map((quote) => ({
      quoteId: quote.quoteId,
      odds: quote.decimalOdds,
      capacity: quote.availableStake,
      observedAt: quote.provenance.observedAt,
      status: quote.provenance.status,
    })),
  });
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
    !isActiveStatus(observation.rawStatus) ||
    probability === null ||
    probability <= 0 ||
    probability > 1 ||
    availableStake === null ||
    availableStake <= 0
  ) {
    return null;
  }

  const status = observation.rawStatus.toLowerCase().startsWith("captured") ? "captured" : sourceStatus;

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
      status,
    },
  };
}

function quoteAgeMs(quote: ProvenancedGenericQuote, now: number): number {
  return Math.max(0, now - Date.parse(quote.provenance.observedAt));
}

function isActiveStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized.includes("active") && !normalized.includes("closed") && !normalized.includes("inactive");
}

function sortQuotes(quotes: ProvenancedGenericQuote[]): ProvenancedGenericQuote[] {
  return [...quotes].sort(
    (left, right) =>
      right.decimalOdds - left.decimalOdds ||
      left.venueId.localeCompare(right.venueId) ||
      left.quoteId.localeCompare(right.quoteId),
  );
}

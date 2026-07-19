import { buildGenericExecutionRoute } from "../execution/router";
import type { GenericExecutionIntent, GenericExecutionRoute } from "../execution/router";
import type { MarketMapping, ObservationWithMapping, ProvenancedGenericQuote } from "./types";

export const REAL_QUOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RealLiveQuoteStatus = "ready-multi-venue" | "single-venue" | "no-current-route" | "quotes-stale" | "no-comparable-overlap";
export type RealCapturedQuoteStatus = "captured-witness" | "no-captured-witness";

export type RealQuoteBuildResult = {
  canonicalSelectionId: string | null;
  currentLiveQuotes: ProvenancedGenericQuote[];
  capturedWitnessQuotes: ProvenancedGenericQuote[];
  liveStatus: RealLiveQuoteStatus;
  capturedStatus: RealCapturedQuoteStatus;
  liveReason: string;
  capturedReason: string | null;
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
      canonicalSelectionId: null,
      currentLiveQuotes: [],
      capturedWitnessQuotes: [],
      liveStatus: "no-comparable-overlap",
      capturedStatus: "no-captured-witness",
      liveReason: "Select a comparable mapped market to compare real venues.",
      capturedReason: null,
    };
  }

  const group = observations.filter(
    (observation) =>
      isComparableMapping(observation.mapping) &&
      observation.mapping.canonicalSelectionId === selectedCanonicalSelectionId,
  );

  if (group.length === 0) {
    return {
      canonicalSelectionId: selectedCanonicalSelectionId,
      currentLiveQuotes: [],
      capturedWitnessQuotes: [],
      liveStatus: "no-comparable-overlap",
      capturedStatus: "no-captured-witness",
      liveReason: "No comparable cross-venue group exists for the selected market.",
      capturedReason: null,
    };
  }

  const allQuotes = group
    .map((observation) => toRealQuote(observation, sourceStatuses?.[observation.venueId] ?? "live"))
    .filter((quote): quote is ProvenancedGenericQuote => quote !== null);
  const capturedWitnessQuotes = sortQuotes(allQuotes.filter((quote) => quote.provenance.status === "captured"));
  const liveQuotes = allQuotes.filter((quote) => quote.provenance.status === "live");
  const currentLiveQuotes = sortQuotes(liveQuotes.filter((quote) => quoteAgeMs(quote, now) <= REAL_QUOTE_MAX_AGE_MS));
  const liveVenueCount = new Set(currentLiveQuotes.map((quote) => quote.venueId)).size;

  return {
    canonicalSelectionId: selectedCanonicalSelectionId,
    currentLiveQuotes,
    capturedWitnessQuotes,
    liveStatus: liveStatusFor({ liveVenueCount, liveQuotes }),
    capturedStatus: capturedWitnessQuotes.length > 0 ? "captured-witness" : "no-captured-witness",
    liveReason: liveReasonFor({ liveVenueCount, liveQuotes }),
    capturedReason:
      capturedWitnessQuotes.length > 0
        ? "Captured real quotes are shown for witness replay only; they are not current live capacity."
        : null,
  };
}

export function quoteGroupSignature(
  result: RealQuoteBuildResult,
  group: "live" | "captured",
): string {
  const quotes = group === "live" ? result.currentLiveQuotes : result.capturedWitnessQuotes;
  return JSON.stringify({
    group,
    status: group === "live" ? result.liveStatus : result.capturedStatus,
    canonicalSelectionId: result.canonicalSelectionId,
    quotes: quotes.map((quote) => ({
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

function liveStatusFor({
  liveVenueCount,
  liveQuotes,
}: {
  liveVenueCount: number;
  liveQuotes: ProvenancedGenericQuote[];
}): RealLiveQuoteStatus {
  if (liveVenueCount >= 2) return "ready-multi-venue";
  if (liveVenueCount === 1) return "single-venue";
  if (liveQuotes.length > 0) return "quotes-stale";
  return "no-current-route";
}

function liveReasonFor({
  liveVenueCount,
  liveQuotes,
}: {
  liveVenueCount: number;
  liveQuotes: ProvenancedGenericQuote[];
}): string {
  if (liveVenueCount >= 2) return "Two or more current live venues are comparable under normal tournament completion.";
  if (liveVenueCount === 1) return "One current live venue is available; cross-venue routing needs at least two current venues.";
  if (liveQuotes.length > 0) return "Comparable live quotes are stale; refresh before building a current paper route.";
  return "No current live comparable quotes are available for routing.";
}

function toRealQuote(observation: ObservationWithMapping, sourceStatus: "live" | "captured"): ProvenancedGenericQuote | null {
  const mapping = observation.mapping;
  const probability = observation.bestAskProbability;
  const availableStake = observation.availableAskSize;
  if (
    !isComparableMapping(mapping) ||
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

function isComparableMapping(mapping: MarketMapping | null): mapping is MarketMapping {
  return mapping?.equivalence === "settlement-exact" || mapping?.equivalence === "normal-completion-comparable";
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

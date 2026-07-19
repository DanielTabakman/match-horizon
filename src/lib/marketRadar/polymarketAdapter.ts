import "server-only";

import { cachedJson } from "./fetching";
import { loadPolymarketFixtureObservations } from "./fixtures";
import {
  normalizePolymarketOutcome,
  parseNumberList,
  parseStringList,
} from "./polymarketNormalize";
import type { ConnectorResult, ExternalMarketObservation } from "./types";
import type { ClobBook, GammaEvent } from "./polymarketNormalize";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const TIMEOUT_MS = 5500;
const CACHE_TTL_MS = 45_000;
const GAMMA_EVENT_LIMIT = 30;
const MAX_MARKETS = 10;
const TARGET_EVENT_SLUG = "world-cup-winner";
const TARGET_CONDITION_ID = "0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f";
const TARGET_TOKEN_ID = "18812649149814341758733697580460697418474693998558159483117100240528657629879";

export async function fetchPolymarketObservations(): Promise<ConnectorResult> {
  const startedAt = Date.now();
  try {
    if (
      process.env.MARKET_RADAR_FORCE_FALLBACK === "all" ||
      process.env.MARKET_RADAR_FORCE_FALLBACK === "polymarket"
    ) {
      throw new Error("Fallback forced by MARKET_RADAR_FORCE_FALLBACK.");
    }

    const observations = await fetchLivePolymarketObservations();
    return {
      health: {
        venueId: "polymarket",
        venueLabel: "Polymarket",
        status: "live",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Imported ${observations.length} public Gamma/CLOB outcomes from Polymarket.`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: false,
    };
  } catch (error) {
    const observations = loadPolymarketFixtureObservations();
    return {
      health: {
        venueId: "polymarket",
        venueLabel: "Polymarket",
        status: "fallback",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Live Polymarket fetch failed; showing committed fixture fallback. ${formatError(error)}`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: true,
    };
  }
}

async function fetchLivePolymarketObservations(): Promise<ExternalMarketObservation[]> {
  const events = await cachedJson<GammaEvent[]>({
    cacheKey: "polymarket:events",
    ttlMs: CACHE_TTL_MS,
    timeoutMs: TIMEOUT_MS,
    url: `${GAMMA_API}/events?active=true&closed=false&limit=${GAMMA_EVENT_LIMIT}`,
  });
  if (!Array.isArray(events)) {
    throw new Error("Polymarket Gamma response did not match expected shape.");
  }

  const candidates = events
    .flatMap((event) => (event.markets ?? []).map((market) => ({ event, market })))
    .filter(({ market }) => market.active && !market.closed)
    .slice(0, MAX_MARKETS);
  const targetedCandidates = await fetchTargetedCandidates();
  const observations: ExternalMarketObservation[] = [];

  for (const { event, market } of dedupeCandidates([...candidates, ...targetedCandidates])) {
    const outcomes = parseStringList(market.outcomes);
    const tokenIds = parseStringList(market.clobTokenIds);
    const prices = parseNumberList(market.outcomePrices);
    for (const [index, tokenId] of tokenIds.entries()) {
      const book = await fetchBook(tokenId);
      observations.push(normalizePolymarketOutcome(event, market, tokenId, outcomes[index] ?? `Outcome ${index + 1}`, prices[index] ?? null, book));
    }
  }

  if (observations.length === 0) {
    throw new Error("Polymarket returned no active public CLOB outcomes.");
  }

  if (!observations.some((observation) => observation.externalOutcomeId === TARGET_TOKEN_ID)) {
    observations.push(
      ...loadPolymarketFixtureObservations()
        .filter((observation) => observation.externalMarketId === TARGET_CONDITION_ID)
        .map((observation) => ({ ...observation, rawStatus: `captured:${observation.rawStatus}` })),
    );
  }

  return dedupeObservations(observations);
}

async function fetchTargetedCandidates(): Promise<Array<{ event: GammaEvent; market: NonNullable<GammaEvent["markets"]>[number] }>> {
  try {
    const event = await cachedJson<GammaEvent>({
      cacheKey: `polymarket:event:${TARGET_EVENT_SLUG}`,
      ttlMs: CACHE_TTL_MS,
      timeoutMs: TIMEOUT_MS,
      url: `${GAMMA_API}/events/slug/${TARGET_EVENT_SLUG}`,
    });
    return (event.markets ?? [])
      .filter((market) => market.conditionId === TARGET_CONDITION_ID && market.active && !market.closed)
      .map((market) => ({ event, market }));
  } catch {
    return [];
  }
}

async function fetchBook(tokenId: string): Promise<ClobBook | null> {
  try {
    return await cachedJson<ClobBook>({
      cacheKey: `polymarket:book:${tokenId}`,
      ttlMs: CACHE_TTL_MS,
      timeoutMs: TIMEOUT_MS,
      url: `${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`,
    });
  } catch {
    return null;
  }
}

function dedupeCandidates<T extends { market: { conditionId?: string; slug?: string } }>(candidates: T[]): T[] {
  return [
    ...new Map(candidates.map((candidate) => [candidate.market.conditionId ?? candidate.market.slug ?? JSON.stringify(candidate.market), candidate])).values(),
  ];
}

function dedupeObservations(observations: ExternalMarketObservation[]): ExternalMarketObservation[] {
  return [
    ...new Map(
      observations.map((observation) => [
        `${observation.venueId}:${observation.externalMarketId}:${observation.externalOutcomeId}`,
        observation,
      ]),
    ).values(),
  ];
}

function newest(observations: ExternalMarketObservation[]): string | null {
  return observations.map((observation) => observation.observedAt).sort().at(-1) ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

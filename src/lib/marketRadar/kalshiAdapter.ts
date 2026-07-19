import "server-only";

import { cachedJson } from "./fetching";
import { loadKalshiFixtureObservations } from "./fixtures";
import { normalizeKalshiMarket } from "./kalshiNormalize";
import type { ConnectorResult, ExternalMarketObservation } from "./types";
import type { KalshiMarket, KalshiOrderbook } from "./kalshiNormalize";

const KALSHI_API = "https://external-api.kalshi.com/trade-api/v2";
const TIMEOUT_MS = 5500;
const CACHE_TTL_MS = 45_000;
const MARKET_LIMIT = 25;
const MAX_MARKETS = 8;

type KalshiMarketsResponse = { cursor?: string; markets?: KalshiMarket[] };

export async function fetchKalshiObservations(): Promise<ConnectorResult> {
  const startedAt = Date.now();
  try {
    if (process.env.MARKET_RADAR_FORCE_FALLBACK === "all" || process.env.MARKET_RADAR_FORCE_FALLBACK === "kalshi") {
      throw new Error("Fallback forced by MARKET_RADAR_FORCE_FALLBACK.");
    }

    const observations = await fetchLiveKalshiObservations();
    return {
      health: {
        venueId: "kalshi",
        venueLabel: "Kalshi",
        status: "live",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Imported ${observations.length} public market outcomes from Kalshi REST.`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: false,
    };
  } catch (error) {
    const observations = loadKalshiFixtureObservations();
    return {
      health: {
        venueId: "kalshi",
        venueLabel: "Kalshi",
        status: "fallback",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Live Kalshi fetch failed; showing committed fixture fallback. ${formatError(error)}`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: true,
    };
  }
}

async function fetchLiveKalshiObservations(): Promise<ExternalMarketObservation[]> {
  const response = await cachedJson<KalshiMarketsResponse>({
    cacheKey: "kalshi:world-cup",
    ttlMs: CACHE_TTL_MS,
    timeoutMs: TIMEOUT_MS,
    url: `${KALSHI_API}/markets?limit=${MARKET_LIMIT}&status=open&event_ticker=KXMENWORLDCUP-26`,
  });
  if (!Array.isArray(response.markets)) {
    throw new Error("Kalshi markets response did not match expected shape.");
  }

  const markets = response.markets.filter((market) => market.market_type === "binary").slice(0, MAX_MARKETS);
  const observedAt = new Date().toISOString();
  const observations: ExternalMarketObservation[] = [];
  for (const market of markets) {
    const book = await cachedJson<KalshiOrderbook>({
      cacheKey: `kalshi:orderbook:${market.ticker}`,
      ttlMs: CACHE_TTL_MS,
      timeoutMs: TIMEOUT_MS,
      url: `${KALSHI_API}/markets/${encodeURIComponent(market.ticker)}/orderbook`,
    });
    observations.push(...normalizeKalshiMarket(market, book, observedAt));
  }
  if (observations.length === 0) {
    throw new Error("Kalshi returned no public World Cup binary markets.");
  }
  return observations;
}

function newest(observations: ExternalMarketObservation[]): string | null {
  return observations.map((observation) => observation.observedAt).sort().at(-1) ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

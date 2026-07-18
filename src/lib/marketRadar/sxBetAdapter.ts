import "server-only";

import { cachedJson } from "./fetching";
import { loadSxBetFixtureObservations } from "./fixtures";
import { normalizeSxBetMarket } from "./sxBetNormalize";
import type { ConnectorResult, ExternalMarketObservation } from "./types";
import type { SxMarket, SxOrder } from "./sxBetNormalize";

const SX_BET_API = "https://api.sx.bet";
const TIMEOUT_MS = 5500;
const CACHE_TTL_MS = 45_000;
const MAX_MARKETS = 12;

type SxActiveMarketsResponse = { status: "success"; data: { markets: SxMarket[] } };
type SxOrdersResponse = { status: "success"; data: SxOrder[] };

export async function fetchSxBetObservations(): Promise<ConnectorResult> {
  const startedAt = Date.now();
  try {
    if (process.env.MARKET_RADAR_FORCE_FALLBACK === "all" || process.env.MARKET_RADAR_FORCE_FALLBACK === "sx-bet") {
      throw new Error("Fallback forced by MARKET_RADAR_FORCE_FALLBACK.");
    }

    const observations = await fetchLiveSxBetObservations();
    return {
      health: {
        venueId: "sx-bet",
        venueLabel: "SX Bet",
        status: "live",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Imported ${observations.length} public active outcomes from SX Bet REST.`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: false,
    };
  } catch (error) {
    const observations = loadSxBetFixtureObservations();
    return {
      health: {
        venueId: "sx-bet",
        venueLabel: "SX Bet",
        status: "fallback",
        importedCount: observations.length,
        observedAt: newest(observations),
        message: `Live SX Bet fetch failed; showing committed fixture fallback. ${formatError(error)}`,
        latencyMs: Date.now() - startedAt,
      },
      observations,
      usedFallback: true,
    };
  }
}

async function fetchLiveSxBetObservations(): Promise<ExternalMarketObservation[]> {
  const response = await cachedJson<SxActiveMarketsResponse>({
    cacheKey: "sx-bet:active",
    ttlMs: CACHE_TTL_MS,
    timeoutMs: TIMEOUT_MS,
    url: `${SX_BET_API}/markets/active?onlyMainLine=true`,
  });
  if (response.status !== "success" || !Array.isArray(response.data?.markets)) {
    throw new Error("SX Bet active markets response did not match expected shape.");
  }

  const markets = response.data.markets.slice(0, MAX_MARKETS);
  const orderPairs = await Promise.all(
    markets.map(async (market) => {
      try {
        const orders = await cachedJson<SxOrdersResponse>({
          cacheKey: `sx-bet:orders:${market.marketHash}`,
          ttlMs: CACHE_TTL_MS,
          timeoutMs: TIMEOUT_MS,
          url: `${SX_BET_API}/orders?marketHashes=${encodeURIComponent(market.marketHash)}&perPage=50`,
        });
        return [market.marketHash, orders.status === "success" && Array.isArray(orders.data) ? orders.data : ([] as SxOrder[])] as const;
      } catch {
        return [market.marketHash, [] as SxOrder[]] as const;
      }
    }),
  );
  const ordersByMarket = new Map(orderPairs);
  const observedAt = new Date().toISOString();
  return markets.flatMap((market) => normalizeSxBetMarket(market, ordersByMarket.get(market.marketHash) ?? [], observedAt));
}

function newest(observations: ExternalMarketObservation[]): string | null {
  return observations.map((observation) => observation.observedAt).sort().at(-1) ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

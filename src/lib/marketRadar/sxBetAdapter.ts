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
const TARGET_MARKET_HASH = "0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1";

type SxMarketsResponse = { status: "success"; data: { markets?: SxMarket[] } | SxMarket[] };
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
  const response = await cachedJson<SxMarketsResponse>({
    cacheKey: "sx-bet:active",
    ttlMs: CACHE_TTL_MS,
    timeoutMs: TIMEOUT_MS,
    url: `${SX_BET_API}/markets/active?onlyMainLine=true`,
  });
  const activeMarkets = extractMarkets(response);
  if (activeMarkets === null) {
    throw new Error("SX Bet active markets response did not match expected shape.");
  }

  const markets = dedupeMarkets([
    ...activeMarkets.filter((market) => market.marketHash !== TARGET_MARKET_HASH).slice(0, MAX_MARKETS),
  ]);
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
  const observations = markets.flatMap((market) => normalizeSxBetMarket(market, ordersByMarket.get(market.marketHash) ?? [], observedAt));
  const targetedObservations = await fetchTargetedSxBetObservations(observedAt);
  return dedupeObservations([...observations, ...targetedObservations]);
}

async function fetchTargetedSxBetObservations(observedAt: string): Promise<ExternalMarketObservation[]> {
  try {
    const response = await cachedJson<SxMarketsResponse>({
      cacheKey: `sx-bet:find:${TARGET_MARKET_HASH}`,
      ttlMs: CACHE_TTL_MS,
      timeoutMs: TIMEOUT_MS,
      url: `${SX_BET_API}/markets/find?marketHashes=${encodeURIComponent(TARGET_MARKET_HASH)}`,
    });
    const market = extractMarkets(response)?.find((candidate) => candidate.marketHash === TARGET_MARKET_HASH) ?? null;
    if (!market) {
      throw new Error("SX Bet targeted witness market was not returned.");
    }
    const orders = await cachedJson<SxOrdersResponse>({
      cacheKey: `sx-bet:orders:${TARGET_MARKET_HASH}`,
      ttlMs: CACHE_TTL_MS,
      timeoutMs: TIMEOUT_MS,
      url: `${SX_BET_API}/orders?marketHashes=${encodeURIComponent(TARGET_MARKET_HASH)}&perPage=50`,
    });
    if (orders.status !== "success" || !Array.isArray(orders.data)) {
      throw new Error("SX Bet targeted witness orders were not returned.");
    }
    return normalizeSxBetMarket(market, orders.data, observedAt);
  } catch {
    return capturedTargetObservations();
  }
}

function capturedTargetObservations(): ExternalMarketObservation[] {
  return loadSxBetFixtureObservations()
    .filter((observation) => observation.externalMarketId === TARGET_MARKET_HASH)
    .map((observation) => ({ ...observation, rawStatus: `captured:${observation.rawStatus}` }));
}

function extractMarkets(response: SxMarketsResponse): SxMarket[] | null {
  if (response.status !== "success") return null;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.markets)) return response.data.markets;
  return null;
}

function dedupeMarkets(markets: SxMarket[]): SxMarket[] {
  return [...new Map(markets.map((market) => [market.marketHash, market])).values()];
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

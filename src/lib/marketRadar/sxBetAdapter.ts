import "server-only";

import { cachedJson } from "./fetching";
import { loadSxBetFixtureObservations } from "./fixtures";
import type { ConnectorResult, ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

const SX_BET_API = "https://api.sx.bet";
const TIMEOUT_MS = 5500;
const CACHE_TTL_MS = 45_000;
const MAX_MARKETS = 12;

type SxMarket = {
  status: string;
  marketHash: string;
  outcomeOneName: string;
  outcomeTwoName: string;
  teamOneName: string;
  teamTwoName: string;
  gameTime?: number;
  sportLabel?: string;
  leagueLabel?: string;
  group1?: string;
};

type SxOrder = {
  marketHash: string;
  totalBetSize: string;
  percentageOdds: string;
  isMakerBettingOutcomeOne: boolean;
  orderStatus: string;
};

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
  return markets.flatMap((market) => normalizeMarket(market, ordersByMarket.get(market.marketHash) ?? [], observedAt));
}

function normalizeMarket(market: SxMarket, orders: SxOrder[], observedAt: string): ExternalMarketObservation[] {
  return [
    normalizeOutcome(market, orders, "outcome-one", market.outcomeOneName, false, observedAt),
    normalizeOutcome(market, orders, "outcome-two", market.outcomeTwoName, true, observedAt),
  ];
}

function normalizeOutcome(
  market: SxMarket,
  orders: SxOrder[],
  externalOutcomeId: "outcome-one" | "outcome-two",
  outcomeLabel: string,
  makerSideForBid: boolean,
  observedAt: string,
): ExternalMarketObservation {
  const bid = orders
    .filter((order) => order.orderStatus === "ACTIVE" && order.isMakerBettingOutcomeOne === makerSideForBid)
    .map(normalizeOrder)
    .filter((order): order is { probability: number; size: number } => order !== null)
    .sort((left, right) => right.probability - left.probability)[0] ?? null;
  const ask = orders
    .filter((order) => order.orderStatus === "ACTIVE" && order.isMakerBettingOutcomeOne !== makerSideForBid)
    .map(normalizeOrder)
    .filter((order): order is { probability: number; size: number } => order !== null)
    .sort((left, right) => left.probability - right.probability)[0] ?? null;
  const midpoint = bid && ask ? (bid.probability + ask.probability) / 2 : ask?.probability ?? bid?.probability ?? null;

  return validateObservation({
    venueId: "sx-bet",
    venueLabel: "SX Bet",
    externalMarketId: market.marketHash,
    externalOutcomeId,
    title: `${market.teamOneName} vs ${market.teamTwoName} - ${market.leagueLabel ?? market.group1 ?? "SX Bet"}`,
    outcomeLabel,
    category: market.leagueLabel ?? market.group1 ?? null,
    sport: market.sportLabel ?? null,
    startsAt: typeof market.gameTime === "number" ? new Date(market.gameTime * 1000).toISOString() : null,
    closesAt: null,
    bestBidProbability: bid?.probability ?? null,
    bestAskProbability: ask?.probability ?? null,
    midpointProbability: midpoint,
    spreadProbability: bid && ask ? Math.max(0, ask.probability - bid.probability) : null,
    availableBidSize: bid?.size ?? null,
    availableAskSize: ask?.size ?? null,
    lastTradeProbability: null,
    observedAt,
    sourceUrl: `https://sx.bet/markets/${market.marketHash}`,
    resolutionSummary: "Public SX Bet active-market metadata. Outcome comparability requires an explicit mapping review.",
    rawStatus: market.status,
  });
}

function normalizeOrder(order: SxOrder): { probability: number; size: number } | null {
  const probability = Number(order.percentageOdds) / 1e20;
  const size = Number(order.totalBetSize) / 1e8;
  return Number.isFinite(probability) && probability >= 0 && probability <= 1 && Number.isFinite(size) && size > 0
    ? { probability, size }
    : null;
}

function newest(observations: ExternalMarketObservation[]): string | null {
  return observations.map((observation) => observation.observedAt).sort().at(-1) ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

import "server-only";

import { cachedJson } from "./fetching";
import { loadPolymarketFixtureObservations } from "./fixtures";
import type { ConnectorResult, ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const TIMEOUT_MS = 5500;
const CACHE_TTL_MS = 45_000;
const MAX_MARKETS = 10;

type GammaEvent = {
  slug?: string;
  title?: string;
  category?: string;
  tags?: Array<{ label?: string }>;
  markets?: GammaMarket[];
};

type GammaMarket = {
  question?: string;
  conditionId?: string;
  slug?: string;
  description?: string;
  outcomes?: string;
  outcomePrices?: string;
  active?: boolean;
  closed?: boolean;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  liquidityNum?: number;
  clobTokenIds?: string;
  acceptingOrders?: boolean;
};

type ClobBook = {
  timestamp?: string;
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
  last_trade_price?: string;
};

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
    url: `${GAMMA_API}/events?active=true&closed=false&limit=8`,
  });
  if (!Array.isArray(events)) {
    throw new Error("Polymarket Gamma response did not match expected shape.");
  }

  const candidates = events
    .flatMap((event) => (event.markets ?? []).map((market) => ({ event, market })))
    .filter(({ market }) => market.active && !market.closed)
    .slice(0, MAX_MARKETS);
  const observations: ExternalMarketObservation[] = [];

  for (const { event, market } of candidates) {
    const outcomes = parseStringList(market.outcomes);
    const tokenIds = parseStringList(market.clobTokenIds);
    const prices = parseNumberList(market.outcomePrices);
    for (const [index, tokenId] of tokenIds.entries()) {
      const book = await fetchBook(tokenId);
      observations.push(normalizeOutcome(event, market, tokenId, outcomes[index] ?? `Outcome ${index + 1}`, prices[index] ?? null, book));
    }
  }

  if (observations.length === 0) {
    throw new Error("Polymarket returned no active public CLOB outcomes.");
  }

  return observations;
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

function normalizeOutcome(
  event: GammaEvent,
  market: GammaMarket,
  tokenId: string,
  outcomeLabel: string,
  fallbackPrice: number | null,
  book: ClobBook | null,
): ExternalMarketObservation {
  const bids = (book?.bids ?? []).map(parseLevel).filter((level): level is { price: number; size: number } => level !== null).sort((left, right) => right.price - left.price);
  const asks = (book?.asks ?? []).map(parseLevel).filter((level): level is { price: number; size: number } => level !== null).sort((left, right) => left.price - right.price);
  const bestBid = bids[0] ?? null;
  const bestAsk = asks[0] ?? null;
  const midpoint = bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : fallbackPrice;
  const lastTrade = book?.last_trade_price === undefined ? market.lastTradePrice ?? null : Number(book.last_trade_price);
  const observedAt = book?.timestamp && Number.isFinite(Number(book.timestamp))
    ? new Date(Number(book.timestamp)).toISOString()
    : new Date(market.updatedAt ?? Date.now()).toISOString();

  return validateObservation({
    venueId: "polymarket",
    venueLabel: "Polymarket",
    externalMarketId: market.conditionId ?? market.slug ?? tokenId,
    externalOutcomeId: tokenId,
    title: market.question ?? event.title ?? "Polymarket market",
    outcomeLabel,
    category: event.category ?? event.tags?.[0]?.label ?? null,
    sport: null,
    startsAt: normalizeDate(market.startDate),
    closesAt: normalizeDate(market.endDate),
    bestBidProbability: bestBid?.price ?? maybeProbability(market.bestBid),
    bestAskProbability: bestAsk?.price ?? maybeProbability(market.bestAsk),
    midpointProbability: midpoint,
    spreadProbability: bestBid && bestAsk ? Math.max(0, bestAsk.price - bestBid.price) : maybeProbability(market.spread),
    availableBidSize: bestBid?.size ?? maybeNumber(market.liquidityNum),
    availableAskSize: bestAsk?.size ?? maybeNumber(market.liquidityNum),
    lastTradeProbability: maybeProbability(lastTrade),
    observedAt,
    sourceUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    resolutionSummary: market.description ?? "Public Polymarket market description.",
    rawStatus: market.acceptingOrders ? "active:accepting-orders" : "active",
  });
}

function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseNumberList(value: string | undefined): Array<number | null> {
  return parseStringList(value).map((item) => {
    const parsed = Number(item);
    return Number.isFinite(parsed) ? parsed : null;
  });
}

function parseLevel(level: { price: string; size: string }): { price: number; size: number } | null {
  const price = Number(level.price);
  const size = Number(level.size);
  return Number.isFinite(price) && price >= 0 && price <= 1 && Number.isFinite(size) && size >= 0
    ? { price, size }
    : null;
}

function normalizeDate(value: string | undefined): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function maybeProbability(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function maybeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function newest(observations: ExternalMarketObservation[]): string | null {
  return observations.map((observation) => observation.observedAt).sort().at(-1) ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

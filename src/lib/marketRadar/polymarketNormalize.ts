import type { ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

export type GammaEvent = {
  slug?: string;
  title?: string;
  category?: string;
  tags?: Array<{ label?: string }>;
  markets?: GammaMarket[];
};

export type GammaMarket = {
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

export type ClobBook = {
  timestamp?: string;
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
  last_trade_price?: string;
};

export function normalizePolymarketOutcome(
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
    availableBidSize: bestBid ? roundUsd(bestBid.price * bestBid.size) : null,
    availableAskSize: bestAsk ? roundUsd(bestAsk.price * bestAsk.size) : null,
    lastTradeProbability: maybeProbability(lastTrade),
    observedAt,
    sourceUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    resolutionSummary: market.description ?? "Public Polymarket market description.",
    rawStatus: market.acceptingOrders ? "active:accepting-orders" : "active",
  });
}

export function parseStringList(value: string | undefined): string[] {
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

export function parseNumberList(value: string | undefined): Array<number | null> {
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

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

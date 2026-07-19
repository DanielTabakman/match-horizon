import type { ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

export type KalshiMarket = {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  market_type?: string;
  category?: string;
  close_time?: string;
  expected_expiration_time?: string;
  expiration_time?: string;
  occurrence_datetime?: string;
  updated_time?: string;
  rules_primary?: string;
  rules_secondary?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
};

export type KalshiOrderbook = {
  orderbook?: {
    yes?: KalshiLevel[];
    no?: KalshiLevel[];
  };
  orderbook_fp?: {
    yes_dollars?: KalshiLevel[];
    no_dollars?: KalshiLevel[];
  };
  timestamp?: string;
  ts?: string;
};

export type KalshiLevel = [string | number, string | number];

type Side = "yes" | "no";
type Level = { probability: number; contracts: number };

export function normalizeKalshiMarket(
  market: KalshiMarket,
  orderbook: KalshiOrderbook | null,
  observedAt: string,
): ExternalMarketObservation[] {
  return [
    normalizeOutcome(market, orderbook, "yes", market.yes_sub_title ?? "Yes", observedAt),
    normalizeOutcome(market, orderbook, "no", market.no_sub_title ?? "No", observedAt),
  ];
}

function normalizeOutcome(
  market: KalshiMarket,
  orderbook: KalshiOrderbook | null,
  side: Side,
  outcomeLabel: string,
  fallbackObservedAt: string,
): ExternalMarketObservation {
  const yesBids = parseBookLevels(orderbook?.orderbook_fp?.yes_dollars ?? orderbook?.orderbook?.yes ?? []);
  const noBids = parseBookLevels(orderbook?.orderbook_fp?.no_dollars ?? orderbook?.orderbook?.no ?? []);
  const ownBids = side === "yes" ? yesBids : noBids;
  const oppositeBids = side === "yes" ? noBids : yesBids;
  const bestBid = bestBidLevel(ownBids);
  const oppositeBestBid = bestBidLevel(oppositeBids);
  const askProbability = oppositeBestBid ? roundProbability(1 - oppositeBestBid.probability) : null;
  const midpoint = bestBid && askProbability !== null ? (bestBid.probability + askProbability) / 2 : askProbability ?? bestBid?.probability ?? null;
  const observedAt = authoritativeTimestamp(orderbook) ?? fallbackObservedAt;

  return validateObservation({
    venueId: "kalshi",
    venueLabel: "Kalshi",
    externalMarketId: market.ticker,
    externalOutcomeId: side,
    title: market.title ?? market.ticker,
    outcomeLabel,
    category: market.event_ticker ?? null,
    sport: titleLooksSports(market.title) ? "Soccer" : null,
    startsAt: normalizeDate(market.occurrence_datetime),
    closesAt: normalizeDate(market.close_time ?? market.expected_expiration_time ?? market.expiration_time),
    bestBidProbability: bestBid?.probability ?? fallbackProbability(side === "yes" ? market.yes_bid_dollars : market.no_bid_dollars),
    bestAskProbability: askProbability ?? fallbackProbability(side === "yes" ? market.yes_ask_dollars : market.no_ask_dollars),
    midpointProbability: midpoint,
    spreadProbability: bestBid && askProbability !== null ? Math.max(0, askProbability - bestBid.probability) : null,
    availableBidSize: bestBid ? roundUsd(bestBid.probability * bestBid.contracts) : null,
    availableAskSize: oppositeBestBid && askProbability !== null ? roundUsd(askProbability * oppositeBestBid.contracts) : null,
    lastTradeProbability: fallbackProbability(market.last_price_dollars),
    observedAt,
    sourceUrl: `https://kalshi.com/markets/${market.ticker}`,
    resolutionSummary: [market.rules_primary, market.rules_secondary].filter(Boolean).join(" "),
    rawStatus: market.status ?? "unknown",
  });
}

function parseBookLevels(levels: KalshiLevel[]): Level[] {
  return levels
    .map((level) => {
      const probability = normalizePrice(level[0]);
      const contracts = Number(level[1]);
      return probability !== null && Number.isFinite(contracts) && contracts > 0 ? { probability, contracts } : null;
    })
    .filter((level): level is Level => level !== null);
}

function bestBidLevel(levels: Level[]): Level | null {
  return levels
    .filter((level) => level.probability > 0 && level.probability < 1)
    .sort((left, right) => right.probability - left.probability)[0] ?? null;
}

function normalizePrice(value: string | number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const probability = parsed > 1 ? parsed / 100 : parsed;
  return probability >= 0 && probability <= 1 ? roundProbability(probability) : null;
}

function fallbackProbability(value: string | undefined): number | null {
  return value === undefined ? null : normalizePrice(value);
}

function authoritativeTimestamp(orderbook: KalshiOrderbook | null): string | null {
  const value = orderbook?.timestamp ?? orderbook?.ts;
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed > 10_000_000_000 ? parsed : parsed * 1000).toISOString();
  }
  return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString();
}

function normalizeDate(value: string | undefined): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function titleLooksSports(title: string | undefined): boolean {
  return /world cup|soccer|football|nba|nfl|mlb|ufc/i.test(title ?? "");
}

function roundProbability(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

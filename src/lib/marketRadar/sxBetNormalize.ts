import type { ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

const PERCENTAGE_ODDS_SCALE = 100_000_000_000_000_000_000n;
const USDC_SCALE = 1_000_000n;

export type SxMarket = {
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

export type SxOrder = {
  marketHash: string;
  totalBetSize: string;
  fillAmount?: string;
  pendingFillAmount?: string;
  percentageOdds: string;
  baseToken?: string;
  isMakerBettingOutcomeOne: boolean;
  orderStatus: string;
};

type TopOfBook = { probability: number; size: number };
type OrderSide = { probability: number; size: number };

export function normalizeSxBetMarket(market: SxMarket, orders: SxOrder[], observedAt: string): ExternalMarketObservation[] {
  return [
    normalizeOutcome(market, orders, "outcome-one", market.outcomeOneName, true, observedAt),
    normalizeOutcome(market, orders, "outcome-two", market.outcomeTwoName, false, observedAt),
  ];
}

function normalizeOutcome(
  market: SxMarket,
  orders: SxOrder[],
  externalOutcomeId: "outcome-one" | "outcome-two",
  outcomeLabel: string,
  outcomeOneSide: boolean,
  observedAt: string,
): ExternalMarketObservation {
  const active = orders.filter((order) => order.orderStatus === "ACTIVE");
  const bids = active
    .filter((order) => order.isMakerBettingOutcomeOne === outcomeOneSide)
    .map(normalizeMakerBid)
    .filter((side): side is OrderSide => side !== null);
  const asks = active
    .filter((order) => order.isMakerBettingOutcomeOne !== outcomeOneSide)
    .map(normalizeTakerAsk)
    .filter((side): side is OrderSide => side !== null);
  const bid = bestSide(bids, "bid");
  const ask = bestSide(asks, "ask");
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

function normalizeMakerBid(order: SxOrder): OrderSide | null {
  const probability = scaledBigIntToNumber(order.percentageOdds, PERCENTAGE_ODDS_SCALE);
  const remainingMakerStake = rawUsdcToNumber(remainingRawUsdc(order));
  if (probability === null || probability <= 0 || probability >= 1 || remainingMakerStake === null || remainingMakerStake <= 0) {
    return null;
  }
  return { probability, size: remainingMakerStake };
}

function normalizeTakerAsk(order: SxOrder): OrderSide | null {
  const makerProbabilityRaw = parseBigInt(order.percentageOdds);
  const makerProbability = scaledBigIntToNumber(order.percentageOdds, PERCENTAGE_ODDS_SCALE);
  const remainingMakerRaw = remainingRawUsdc(order);
  if (
    makerProbabilityRaw === null ||
    makerProbabilityRaw <= 0n ||
    makerProbabilityRaw >= PERCENTAGE_ODDS_SCALE ||
    makerProbability === null ||
    remainingMakerRaw === null ||
    remainingMakerRaw <= 0n
  ) {
    return null;
  }
  const takerProbability = 1 - makerProbability;
  const remainingTakerRaw = (remainingMakerRaw * PERCENTAGE_ODDS_SCALE) / makerProbabilityRaw - remainingMakerRaw;
  const takerStake = rawUsdcToNumber(remainingTakerRaw);
  if (takerStake === null || takerStake <= 0) {
    return null;
  }
  return { probability: takerProbability, size: takerStake };
}

function bestSide(sides: OrderSide[], kind: "bid" | "ask"): TopOfBook | null {
  const sorted = sides
    .filter((side) => Number.isFinite(side.probability) && side.probability > 0 && side.probability < 1 && Number.isFinite(side.size) && side.size > 0)
    .sort((left, right) => (kind === "bid" ? right.probability - left.probability : left.probability - right.probability));
  const top = sorted[0];
  if (!top) {
    return null;
  }
  return {
    probability: roundProbability(top.probability),
    size: roundUsd(sorted.filter((side) => roundProbability(side.probability) === roundProbability(top.probability)).reduce((sum, side) => sum + side.size, 0)),
  };
}

function remainingRawUsdc(order: SxOrder): bigint | null {
  const total = parseBigInt(order.totalBetSize);
  const filled = parseBigInt(order.fillAmount ?? "0");
  const pending = parseBigInt(order.pendingFillAmount ?? "0");
  if (total === null || filled === null || pending === null) {
    return null;
  }
  const remaining = total - filled - pending;
  return remaining > 0n ? remaining : null;
}

function rawUsdcToNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value) / Number(USDC_SCALE);
}

function scaledBigIntToNumber(value: string, scale: bigint): number | null {
  const parsed = parseBigInt(value);
  if (parsed === null || parsed < 0n || parsed > scale) {
    return null;
  }
  return Number(parsed) / Number(scale);
}

function parseBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function roundProbability(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

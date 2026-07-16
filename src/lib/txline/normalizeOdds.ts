import type { Fixture, MarketSnapshot, OutcomeQuote } from "../domain";
import { TxlineNormalizationError } from "./normalizationErrors";
import type { TxlineOddsRecord } from "./schemas";

const SUPPORTED_MARKET_TYPE = "1X2_PARTICIPANT_RESULT";
const SUPPORTED_PRICE_NAMES = ["part1", "draw", "part2"] as const;

type SupportedPriceName = (typeof SUPPORTED_PRICE_NAMES)[number];

export function normalizeTxlineMatchResultMarket(
  records: TxlineOddsRecord[],
  fixture: Fixture,
  capturedAt: string,
): MarketSnapshot {
  const supported = records.filter((record) => isSupportedFullMatchResult(record, fixture.fixtureId));

  if (supported.length === 0) {
    throw new TxlineNormalizationError(
      "No supported full-match three-way result market was found for the fixture.",
      "unsupported_market",
    );
  }

  if (supported.length > 1) {
    throw new TxlineNormalizationError(
      "Multiple supported full-match three-way result markets were found for the fixture.",
      "ambiguous_data",
    );
  }

  return normalizeSupportedRecord(supported[0], fixture, capturedAt);
}

function isSupportedFullMatchResult(record: TxlineOddsRecord, fixtureId: string): boolean {
  return (
    String(record.FixtureId) === fixtureId &&
    record.SuperOddsType === SUPPORTED_MARKET_TYPE &&
    record.MarketPeriod === null &&
    record.MarketParameters === null
  );
}

function normalizeSupportedRecord(
  record: TxlineOddsRecord,
  fixture: Fixture,
  capturedAt: string,
): MarketSnapshot {
  const pctByName = parseProbabilitiesByPriceName(record.PriceNames, record.Pct);
  const outcomes: OutcomeQuote[] = [
    { outcomeId: "participant_1", label: fixture.participant1, probability: pctByName.part1 },
    { outcomeId: "draw", label: "Draw", probability: pctByName.draw },
    { outcomeId: "participant_2", label: fixture.participant2, probability: pctByName.part2 },
  ];

  assertProbabilityInvariants(outcomes);

  return {
    fixtureId: fixture.fixtureId,
    marketType: "match_result",
    capturedAt,
    outcomes,
    source: "txline_capture",
  };
}

function parseProbabilitiesByPriceName(
  priceNames: unknown,
  pct: unknown,
): Record<SupportedPriceName, number> {
  if (!Array.isArray(priceNames) || !Array.isArray(pct)) {
    throw new TxlineNormalizationError(
      "Supported match-result market must contain price-name and probability arrays.",
      "ambiguous_data",
    );
  }

  if (priceNames.length !== pct.length) {
    throw new TxlineNormalizationError(
      "Supported match-result price-name and probability arrays must have equal length.",
      "ambiguous_data",
    );
  }

  if (priceNames.length !== SUPPORTED_PRICE_NAMES.length) {
    throw new TxlineNormalizationError(
      "Supported match-result market must contain exactly three outcomes.",
      "ambiguous_data",
    );
  }

  const probabilitiesByName: Partial<Record<SupportedPriceName, number>> = {};
  for (const [index, rawName] of priceNames.entries()) {
    const name = parseSupportedPriceName(rawName);
    if (probabilitiesByName[name] !== undefined) {
      throw new TxlineNormalizationError(
        `Duplicate match-result outcome name: ${name}.`,
        "ambiguous_data",
      );
    }

    probabilitiesByName[name] = parseProbabilityPercentage(pct[index]);
  }

  const missing = SUPPORTED_PRICE_NAMES.filter((name) => probabilitiesByName[name] === undefined);
  if (missing.length > 0) {
    throw new TxlineNormalizationError(
      `Supported match-result market is missing outcome names: ${missing.join(", ")}.`,
      "ambiguous_data",
    );
  }

  return probabilitiesByName as Record<SupportedPriceName, number>;
}

function parseSupportedPriceName(value: unknown): SupportedPriceName {
  if (typeof value !== "string" || !SUPPORTED_PRICE_NAMES.includes(value as SupportedPriceName)) {
    throw new TxlineNormalizationError(
      `Unsupported match-result outcome name: ${String(value)}.`,
      "ambiguous_data",
    );
  }

  return value as SupportedPriceName;
}

function parseProbabilityPercentage(value: unknown): number {
  if (typeof value === "string" && value.trim() === "") {
    throw new TxlineNormalizationError(
      "Supported match-result probabilities must not be blank.",
      "ambiguous_data",
    );
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new TxlineNormalizationError(
      "Supported match-result probabilities must be finite percentage values.",
      "ambiguous_data",
    );
  }

  const probability = Number(value) / 100;
  if (!Number.isFinite(probability)) {
    throw new TxlineNormalizationError(
      "Supported match-result probabilities must be finite percentage values.",
      "ambiguous_data",
    );
  }

  return probability;
}

function assertProbabilityInvariants(outcomes: OutcomeQuote[]): void {
  const ids = new Set(outcomes.map((outcome) => outcome.outcomeId));
  const total = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);

  if (
    outcomes.length !== 3 ||
    ids.size !== 3 ||
    outcomes.some((outcome) => outcome.probability < 0 || outcome.probability > 1) ||
    Math.abs(total - 1) > 0.01
  ) {
    throw new TxlineNormalizationError(
      `Supported match-result probabilities failed invariant checks; observed total ${total.toFixed(6)}.`,
      "ambiguous_data",
    );
  }
}

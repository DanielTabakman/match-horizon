import type { Fixture, MarketSnapshot, OutcomeQuote } from "../domain";
import { TxlineNormalizationError } from "./normalizationErrors";
import type { TxlineOddsRecord } from "./schemas";

const SUPPORTED_MARKET_TYPE = "1X2_PARTICIPANT_RESULT";
const SUPPORTED_PRICE_NAMES = ["part1", "draw", "part2"] as const;

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
  assertPriceNames(record.PriceNames);
  const pct = parseProbabilityPercentages(record.Pct);
  const outcomes: OutcomeQuote[] = [
    { outcomeId: "participant_1", label: fixture.participant1, probability: pct[0] },
    { outcomeId: "draw", label: "Draw", probability: pct[1] },
    { outcomeId: "participant_2", label: fixture.participant2, probability: pct[2] },
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

function assertPriceNames(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length !== SUPPORTED_PRICE_NAMES.length) {
    throw new TxlineNormalizationError(
      "Supported match-result market must contain exactly three price names.",
      "ambiguous_data",
    );
  }

  const observed = value.map((item) => String(item));
  if (!SUPPORTED_PRICE_NAMES.every((expected, index) => observed[index] === expected)) {
    throw new TxlineNormalizationError(
      `Unsupported match-result price names: ${observed.join(", ")}.`,
      "ambiguous_data",
    );
  }
}

function parseProbabilityPercentages(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TxlineNormalizationError(
      "Supported match-result market must contain exactly three probability values.",
      "ambiguous_data",
    );
  }

  const probabilities = value.map((item) => {
    if (typeof item !== "string" && typeof item !== "number") {
      return Number.NaN;
    }

    return Number(item) / 100;
  });

  if (probabilities.some((probability) => !Number.isFinite(probability))) {
    throw new TxlineNormalizationError(
      "Supported match-result probabilities must be finite percentage values.",
      "ambiguous_data",
    );
  }

  return probabilities as [number, number, number];
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

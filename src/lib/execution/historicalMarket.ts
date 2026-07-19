import rawHistoricalMarketSnapshot from "../../../test-fixtures/historical-market/france-spain-18237038-closing-1x2.json";
import type { OutcomeQuote } from "../domain";

export const HISTORICAL_MARKET_SOURCE_NOTE =
  "Historical closing odds captured from OddsLab (odds data attributed there to The Odds API). Capacity and fills are simulated.";

export type HistoricalMarketProvenanceType = "historical-third-party-reference";
export type HistoricalMarketTimepoint = "closing";
export type HistoricalMarketType = "full-time 1X2";

export type HistoricalBookmakerLine = {
  id: string;
  name: string;
  prices: Record<OutcomeQuote["outcomeId"], number>;
};

export type HistoricalMarketSnapshot = {
  schemaVersion: 1;
  fixtureId: 18237038;
  match: {
    participant1: "France";
    participant2: "Spain";
    competition: "FIFA World Cup 2026 semifinal";
    kickoff: "2026-07-14T19:00:00Z";
  };
  market: {
    type: HistoricalMarketType;
    timepoint: HistoricalMarketTimepoint;
  };
  source: {
    url: string;
    oddsDataAttributedTo: "The Odds API";
    retrievedAt: string;
    provenanceType: HistoricalMarketProvenanceType;
  };
  bookmakers: HistoricalBookmakerLine[];
};

const REQUIRED_OUTCOMES: OutcomeQuote["outcomeId"][] = ["participant_1", "draw", "participant_2"];
const HISTORICAL_MARKET_OUTCOME_LABELS: Record<OutcomeQuote["outcomeId"], string> = {
  participant_1: "France",
  draw: "Draw",
  participant_2: "Spain",
};

export const HISTORICAL_MARKET_SNAPSHOT = validateHistoricalMarketSnapshot(rawHistoricalMarketSnapshot);

export function buildHistoricalMarketSelection(outcomeId: OutcomeQuote["outcomeId"]) {
  return {
    selectedOutcomeId: outcomeId,
    selectedOutcomeLabel: HISTORICAL_MARKET_OUTCOME_LABELS[outcomeId],
    selectedPriceHeader: `Selected ${HISTORICAL_MARKET_OUTCOME_LABELS[outcomeId]} price`,
  };
}

export function validateHistoricalMarketSnapshot(value: unknown): HistoricalMarketSnapshot {
  if (!isRecord(value)) {
    throw new Error("Historical market snapshot must be an object.");
  }

  assertLiteral(value.schemaVersion, 1, "schemaVersion");
  assertLiteral(value.fixtureId, 18237038, "fixtureId");

  if (!isRecord(value.match)) {
    throw new Error("Historical market snapshot match must be an object.");
  }
  assertLiteral(value.match.participant1, "France", "match.participant1");
  assertLiteral(value.match.participant2, "Spain", "match.participant2");
  assertLiteral(value.match.competition, "FIFA World Cup 2026 semifinal", "match.competition");
  assertIsoTimestamp(value.match.kickoff, "match.kickoff");
  assertLiteral(value.match.kickoff, "2026-07-14T19:00:00Z", "match.kickoff");

  if (!isRecord(value.market)) {
    throw new Error("Historical market snapshot market must be an object.");
  }
  assertLiteral(value.market.type, "full-time 1X2", "market.type");
  assertLiteral(value.market.timepoint, "closing", "market.timepoint");

  if (!isRecord(value.source)) {
    throw new Error("Historical market snapshot source must be an object.");
  }
  assertNonEmptyString(value.source.url, "source.url");
  assertLiteral(
    value.source.url,
    "https://market.oddslab.gg/leagues/world-cup-2026/matches/world_cup_2026-france-vs-spain",
    "source.url",
  );
  assertLiteral(value.source.oddsDataAttributedTo, "The Odds API", "source.oddsDataAttributedTo");
  assertIsoTimestamp(value.source.retrievedAt, "source.retrievedAt");
  assertLiteral(
    value.source.provenanceType,
    "historical-third-party-reference",
    "source.provenanceType",
  );

  if (!Array.isArray(value.bookmakers)) {
    throw new Error("Historical market snapshot bookmakers must be an array.");
  }

  const bookmakers = value.bookmakers.map(validateBookmakerLine);
  const names = bookmakers.map((bookmaker) => bookmaker.name);
  assertSet(names, ["Matchbook", "Pinnacle", "William Hill"], "bookmaker names");

  return {
    schemaVersion: 1,
    fixtureId: 18237038,
    match: {
      participant1: "France",
      participant2: "Spain",
      competition: "FIFA World Cup 2026 semifinal",
      kickoff: "2026-07-14T19:00:00Z",
    },
    market: {
      type: "full-time 1X2",
      timepoint: "closing",
    },
    source: {
      url: value.source.url,
      oddsDataAttributedTo: "The Odds API",
      retrievedAt: value.source.retrievedAt,
      provenanceType: "historical-third-party-reference",
    },
    bookmakers,
  };
}

function validateBookmakerLine(value: unknown): HistoricalBookmakerLine {
  if (!isRecord(value)) {
    throw new Error("Historical bookmaker line must be an object.");
  }

  assertNonEmptyString(value.id, "bookmaker.id");
  assertNonEmptyString(value.name, "bookmaker.name");

  if (!isRecord(value.prices)) {
    throw new Error(`Historical bookmaker ${value.name} prices must be an object.`);
  }

  const prices = {} as Record<OutcomeQuote["outcomeId"], number>;
  for (const outcomeId of REQUIRED_OUTCOMES) {
    const price = value.prices[outcomeId];
    if (!Number.isFinite(price) || typeof price !== "number" || price <= 1) {
      throw new Error(`Historical bookmaker ${value.name} ${outcomeId} price must be greater than 1.`);
    }
    prices[outcomeId] = price;
  }

  assertSet(Object.keys(value.prices), REQUIRED_OUTCOMES, `Historical bookmaker ${value.name} outcomes`);

  return {
    id: value.id,
    name: value.name,
    prices,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertLiteral<T extends string | number>(actual: unknown, expected: T, label: string): asserts actual is T {
  if (actual !== expected) {
    throw new Error(`Historical market snapshot ${label} must be ${expected}.`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Historical market snapshot ${label} must be a non-empty string.`);
  }
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Historical market snapshot ${label} must be an ISO timestamp.`);
  }
}

function assertSet(actual: string[], expected: readonly string[], label: string) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (
    actualSorted.length !== expectedSorted.length ||
    actualSorted.some((value, index) => value !== expectedSorted[index])
  ) {
    throw new Error(`Historical market snapshot ${label} must be ${expected.join(", ")}.`);
  }
}

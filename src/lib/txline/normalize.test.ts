import { describe, expect, it } from "vitest";
import type { Fixture } from "../domain";
import { normalizeTxlineFixture } from "./normalizeFixture";
import { normalizeTxlineMatchResultMarket } from "./normalizeOdds";
import { normalizeTxlineScoreEvents } from "./normalizeScores";
import { TxlineNormalizationError } from "./normalizationErrors";
import fixturesCapture from "../../../test-fixtures/txline/fixtures-snapshot.json";
import oddsCapture from "../../../test-fixtures/txline/odds-snapshot.json";
import scoresCapture from "../../../test-fixtures/txline/scores-sample.json";

const worldCupFixtureRecord = fixturesCapture.sample.find(
  (record) => record.FixtureId === 18237038,
);

if (!worldCupFixtureRecord) {
  throw new Error("Expected fixture 18237038 in the sanitized TxLINE fixture capture.");
}

describe("TxLINE fixture normalization", () => {
  it("normalizes the observed World Cup fixture without exposing raw fields", () => {
    expect(normalizeTxlineFixture(worldCupFixtureRecord)).toEqual({
      fixtureId: "18237038",
      participant1: "France",
      participant2: "Spain",
      startsAt: "2026-07-14T19:00:00.000Z",
      status: "unknown",
    });
  });
});

describe("TxLINE full-match three-way odds normalization", () => {
  const fixture = normalizeTxlineFixture(worldCupFixtureRecord);

  it("normalizes only the observed full-match 1X2 participant-result market", () => {
    const market = normalizeTxlineMatchResultMarket(
      oddsCapture.sample,
      fixture,
      oddsCapture.capturedAt,
    );

    expect(market).toEqual({
      fixtureId: "18237038",
      marketType: "match_result",
      capturedAt: "2026-07-14T18:42:08.439Z",
      source: "txline_capture",
      outcomes: [
        { outcomeId: "participant_1", label: "France", probability: 0.37272 },
        { outcomeId: "draw", label: "Draw", probability: 0.31837 },
        { outcomeId: "participant_2", label: "Spain", probability: 0.30893 },
      ],
    });

    const total = market.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it("rejects non-full-match or unsupported markets explicitly", () => {
    const halfOnly = oddsCapture.sample.filter((record) => record.MarketPeriod === "half=1");

    expect(() =>
      normalizeTxlineMatchResultMarket(halfOnly, fixture, oddsCapture.capturedAt),
    ).toThrowError(TxlineNormalizationError);
  });

  it("rejects ambiguous match-result outcome names", () => {
    const ambiguous = [
      {
        ...oddsCapture.sample[1],
        PriceNames: ["part1", "part2", "draw"],
      },
    ];

    expect(() =>
      normalizeTxlineMatchResultMarket(ambiguous, fixture, oddsCapture.capturedAt),
    ).toThrow(/Unsupported match-result price names/);
  });

  it("rejects probability values that cannot support the three-way invariant", () => {
    const badProbability = [
      {
        ...oddsCapture.sample[1],
        Pct: ["NA", "31.837", "30.893"],
      },
    ];

    expect(() =>
      normalizeTxlineMatchResultMarket(badProbability, fixture, oddsCapture.capturedAt),
    ).toThrow(/finite percentage/);
  });

  it("rejects duplicate supported full-match markets as ambiguous", () => {
    const duplicate = [oddsCapture.sample[1], oddsCapture.sample[1]];

    expect(() =>
      normalizeTxlineMatchResultMarket(duplicate, fixture, oddsCapture.capturedAt),
    ).toThrow(/Multiple supported/);
  });
});

describe("TxLINE score normalization", () => {
  it("normalizes observed score-feed records deterministically", () => {
    const events = normalizeTxlineScoreEvents(scoresCapture.sample);

    expect(events).toHaveLength(5);
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 12, 13]);
    expect(events[0]).toEqual({
      fixtureId: "18237038",
      occurredAt: "2026-07-10T21:19:31.797Z",
      sequence: 0,
      eventType: "coverage_update",
      score1: null,
      score2: null,
      period: null,
      rawReference: "coverage_update:0",
    });
  });

  it("fails explicitly when required score event fields are missing", () => {
    expect(() => normalizeTxlineScoreEvents([{ FixtureId: 18237038 }])).toThrow(
      TxlineNormalizationError,
    );
  });
});

describe("Raw TxLINE boundary", () => {
  it("keeps normalized market data free of raw TxLINE field names", () => {
    const fixture: Fixture = normalizeTxlineFixture(worldCupFixtureRecord);
    const market = normalizeTxlineMatchResultMarket(
      oddsCapture.sample,
      fixture,
      oddsCapture.capturedAt,
    );

    expect(JSON.stringify(market)).not.toMatch(
      /SuperOddsType|MarketPeriod|MarketParameters|PriceNames|Pct|Bookmaker/,
    );
  });
});

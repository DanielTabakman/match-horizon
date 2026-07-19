import { describe, expect, it } from "vitest";
import {
  HISTORICAL_MARKET_SNAPSHOT,
  validateHistoricalMarketSnapshot,
} from "./historicalMarket";

describe("historical market snapshot", () => {
  it("loads the authorized France vs Spain closing 1X2 capture", () => {
    expect(HISTORICAL_MARKET_SNAPSHOT).toMatchObject({
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
        url: "https://market.oddslab.gg/leagues/world-cup-2026/matches/world_cup_2026-france-vs-spain",
        oddsDataAttributedTo: "The Odds API",
        provenanceType: "historical-third-party-reference",
      },
    });
    expect(HISTORICAL_MARKET_SNAPSHOT.bookmakers).toEqual([
      {
        id: "matchbook",
        name: "Matchbook",
        prices: { participant_1: 2.72, draw: 3, participant_2: 3.25 },
      },
      {
        id: "pinnacle",
        name: "Pinnacle",
        prices: { participant_1: 2.6, draw: 3.03, participant_2: 3.23 },
      },
      {
        id: "william-hill",
        name: "William Hill",
        prices: { participant_1: 2.38, draw: 3.1, participant_2: 3 },
      },
    ]);
  });

  it("rejects incomplete bookmaker lines", () => {
    const invalid = structuredClone(HISTORICAL_MARKET_SNAPSHOT);
    delete (invalid.bookmakers[0].prices as Partial<typeof invalid.bookmakers[0]["prices"]>).draw;

    expect(() => validateHistoricalMarketSnapshot(invalid)).toThrow(/outcomes|draw/);
  });

  it("rejects provenance drift", () => {
    expect(() =>
      validateHistoricalMarketSnapshot({
        ...HISTORICAL_MARKET_SNAPSHOT,
        source: {
          ...HISTORICAL_MARKET_SNAPSHOT.source,
          provenanceType: "live-bookmaker-api",
        },
      }),
    ).toThrow(/provenanceType/);
  });
});

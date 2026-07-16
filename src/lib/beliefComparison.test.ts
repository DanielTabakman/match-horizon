import { describe, expect, it } from "vitest";
import type { MarketSnapshot } from "./domain";
import { compareBeliefsToMarket } from "./beliefComparison";

const market: MarketSnapshot = {
  fixtureId: "18237038",
  marketType: "match_result",
  capturedAt: "2026-07-14T18:42:08.439Z",
  source: "txline_capture",
  outcomes: [
    { outcomeId: "participant_1", label: "France", probability: 0.37272 },
    { outcomeId: "draw", label: "Draw", probability: 0.31837 },
    { outcomeId: "participant_2", label: "Spain", probability: 0.30893 },
  ],
};

describe("compareBeliefsToMarket", () => {
  it("calculates deterministic disagreement points in canonical outcome order", () => {
    const comparison = compareBeliefsToMarket(market, {
      participant_1: 0.45,
      draw: 0.25,
      participant_2: 0.3,
    });

    expect(comparison).toMatchObject({
      totalBelief: 1,
      isValid: true,
      outcomes: [
        { outcomeId: "participant_1", disagreementPoints: 7.7 },
        { outcomeId: "draw", disagreementPoints: -6.8 },
        { outcomeId: "participant_2", disagreementPoints: -0.9 },
      ],
      strongestPositive: {
        outcomeId: "participant_1",
        label: "France",
        disagreementPoints: 7.7,
      },
    });
  });

  it("selects the strongest positive disagreement before display rounding", () => {
    const closeMarket: MarketSnapshot = {
      ...market,
      outcomes: [
        { outcomeId: "participant_1", label: "France", probability: 0.37046 },
        { outcomeId: "draw", label: "Draw", probability: 0.32045 },
        { outcomeId: "participant_2", label: "Spain", probability: 0.30909 },
      ],
    };

    const comparison = compareBeliefsToMarket(closeMarket, {
      participant_1: 0.4,
      draw: 0.35,
      participant_2: 0.25,
    });

    expect(comparison.outcomes).toMatchObject([
      { outcomeId: "participant_1", disagreementPoints: 3 },
      { outcomeId: "draw", disagreementPoints: 3 },
      { outcomeId: "participant_2", disagreementPoints: -5.9 },
    ]);
    expect(comparison.strongestPositive).toMatchObject({
      outcomeId: "draw",
      label: "Draw",
      disagreementPoints: 3,
    });
    expect(comparison.strongestPositive?.probabilityDelta).toBeCloseTo(0.02955, 6);
  });

  it("returns no strongest positive expression when the user is not above market on any outcome", () => {
    const comparison = compareBeliefsToMarket(market, {
      participant_1: 0.3,
      draw: 0.31,
      participant_2: 0.3,
    });

    expect(comparison.isValid).toBe(false);
    expect(comparison.strongestPositive).toBeNull();
  });

  it("fails explicitly for missing market outcomes", () => {
    const incompleteMarket = {
      ...market,
      outcomes: market.outcomes.filter((outcome) => outcome.outcomeId !== "draw"),
    };

    expect(() =>
      compareBeliefsToMarket(incompleteMarket, {
        participant_1: 0.45,
        draw: 0.25,
        participant_2: 0.3,
      }),
    ).toThrow(/missing required outcome draw/);
  });

  it("fails explicitly for invalid belief probabilities", () => {
    expect(() =>
      compareBeliefsToMarket(market, {
        participant_1: 1.1,
        draw: 0,
        participant_2: -0.1,
      }),
    ).toThrow(/between 0 and 1/);
  });
});

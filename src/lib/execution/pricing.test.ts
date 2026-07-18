import { describe, expect, it } from "vitest";
import { DEMO_LIQUIDITY_BOOK } from "./demoLiquidity";
import {
  buildExecutionPlanKey,
  calculateExpectedReturn,
  calculateFullKellyFraction,
  calculateKellySizingPolicy,
  calculatePricingPolicy,
} from "./pricing";
import { buildExecutionRoute } from "./router";
import { buildPaperPredictionMarketQuote } from "./paperQuote";

describe("required-edge pricing", () => {
  it("converts a 50% belief and 10% required edge into 2.20 minimum odds", () => {
    expect(calculatePricingPolicy(0.5, 0.1)).toEqual({
      userProbability: 0.5,
      requiredEdge: 0.1,
      fairDecimalOdds: 2,
      minimumDecimalOdds: 2.2,
    });
  });

  it("makes zero required edge equal to fair odds", () => {
    expect(calculatePricingPolicy(0.5, 0)).toEqual({
      userProbability: 0.5,
      requiredEdge: 0,
      fairDecimalOdds: 2,
      minimumDecimalOdds: 2,
    });
  });

  it("calculates expected return at decimal odds", () => {
    expect(calculateExpectedReturn(0.5, 2.2)).toBeCloseTo(0.1);
    expect(calculateExpectedReturn(0.5, 3.368)).toBeCloseTo(0.684);
  });

  it("rejects invalid probability, edge, and odds", () => {
    expect(() => calculatePricingPolicy(0, 0.1)).toThrow(/probability/);
    expect(() => calculatePricingPolicy(1.01, 0.1)).toThrow(/probability/);
    expect(() => calculatePricingPolicy(0.5, -0.01)).toThrow(/edge/);
    expect(() => calculatePricingPolicy(0.5, Number.POSITIVE_INFINITY)).toThrow(/edge/);
    expect(() => calculateExpectedReturn(0.5, 1)).toThrow(/odds/);
    expect(() => calculateExpectedReturn(0.5, Number.NaN)).toThrow(/odds/);
  });
});

describe("fractional Kelly sizing", () => {
  it("calculates full Kelly for p=0.50 and d=2.20", () => {
    expect(calculateFullKellyFraction(0.5, 2.2)).toBeCloseTo(1 / 12);
  });

  it("calculates the default Half Kelly Spain policy", () => {
    const policy = calculateKellySizingPolicy({
      userProbability: 0.5,
      requiredEdge: 0.1,
      bankroll: 120000,
      kellyMultiplier: "half",
    });

    expect(policy.fullKellyFraction).toBeCloseTo(1 / 12);
    expect(policy.appliedKellyFraction).toBeCloseTo(1 / 24);
    expect(policy.suggestedStake).toBe(5000);
  });

  it("supports quarter and full Kelly multipliers", () => {
    expect(
      calculateKellySizingPolicy({
        userProbability: 0.5,
        requiredEdge: 0.1,
        bankroll: 120000,
        kellyMultiplier: "quarter",
      }).suggestedStake,
    ).toBe(2500);
    expect(
      calculateKellySizingPolicy({
        userProbability: 0.5,
        requiredEdge: 0.1,
        bankroll: 120000,
        kellyMultiplier: "full",
      }).suggestedStake,
    ).toBe(10000);
  });

  it("returns zero stake for non-positive expected edge", () => {
    expect(calculateFullKellyFraction(0.5, 2)).toBe(0);
    expect(
      calculateKellySizingPolicy({
        userProbability: 0.5,
        requiredEdge: 0,
        bankroll: 120000,
        kellyMultiplier: "half",
      }).suggestedStake,
    ).toBe(0);
  });

  it("rejects invalid bankroll and unsupported multipliers", () => {
    expect(() =>
      calculateKellySizingPolicy({
        userProbability: 0.5,
        requiredEdge: 0.1,
        bankroll: 0,
        kellyMultiplier: "half",
      }),
    ).toThrow(/bankroll/);
    expect(() =>
      calculateKellySizingPolicy({
        userProbability: 0.5,
        requiredEdge: 0.1,
        bankroll: 120000,
        kellyMultiplier: "double" as never,
      }),
    ).toThrow(/Kelly multiplier/);
  });
});

describe("default pricing policy with the router", () => {
  it("produces the target stake, minimum odds, and existing Spain fills", () => {
    const policy = calculateKellySizingPolicy({
      userProbability: 0.5,
      requiredEdge: 0.1,
      bankroll: 120000,
      kellyMultiplier: "half",
    });
    const route = buildExecutionRoute(
      {
        outcomeId: "participant_2",
        requestedStake: policy.suggestedStake,
        minimumDecimalOdds: policy.minimumDecimalOdds,
        userProbability: policy.userProbability,
      },
      DEMO_LIQUIDITY_BOOK,
    );

    expect(policy.minimumDecimalOdds).toBe(2.2);
    expect(route.requestedStake).toBe(5000);
    expect(route.fills).toMatchObject([
      { quoteId: "spain-a", filledStake: 500, decimalOdds: 3.5 },
      { quoteId: "spain-b", filledStake: 2000, decimalOdds: 3.42 },
      { quoteId: "spain-c", filledStake: 2500, decimalOdds: 3.3 },
    ]);
    expect(route.weightedAverageOdds).toBe(3.368);
    expect(route.estimatedGrossPayout).toBe(16840);
  });

  it("changes the route invalidation key when pricing or sizing inputs change", () => {
    const baseKey = buildExecutionPlanKey({
      strategyPresetId: "standard",
      outcomeId: "participant_2",
      userProbability: 0.5,
      requiredEdgePercent: "10",
      bankroll: "120000",
      kellyMultiplier: "half",
      sizingMode: "kelly",
      manualStake: "5000",
      includePaperQuote: false,
      paperDecimalOdds: "3.25",
      paperAvailableStake: "1000",
    });

    const variants = [
      { strategyPresetId: "conservative" },
      { requiredEdgePercent: "12" },
      { bankroll: "90000" },
      { kellyMultiplier: "quarter" as const },
      { sizingMode: "manual" as const },
      { manualStake: "4500" },
      { userProbability: 0.49 },
      { includePaperQuote: true },
      { paperDecimalOdds: "3.1" },
      { paperAvailableStake: "500" },
    ].map((change) =>
      buildExecutionPlanKey({
        strategyPresetId: "standard",
        outcomeId: "participant_2",
        userProbability: 0.5,
        requiredEdgePercent: "10",
        bankroll: "120000",
        kellyMultiplier: "half",
        sizingMode: "kelly",
        manualStake: "5000",
        includePaperQuote: false,
        paperDecimalOdds: "3.25",
        paperAvailableStake: "1000",
        ...change,
      }),
    );

    expect(new Set(variants)).not.toContain(baseKey);
  });

  it("routes a valid paper prediction-market quote through the existing router", () => {
    const policy = calculateKellySizingPolicy({
      userProbability: 0.5,
      requiredEdge: 0.1,
      bankroll: 120000,
      kellyMultiplier: "half",
    });
    const paperQuote = buildPaperPredictionMarketQuote({
      enabled: true,
      outcomeId: "participant_2",
      decimalOdds: 3.25,
      availableStake: 1000,
    });
    const route = buildExecutionRoute(
      {
        outcomeId: "participant_2",
        requestedStake: policy.suggestedStake + 1000,
        minimumDecimalOdds: policy.minimumDecimalOdds,
        userProbability: policy.userProbability,
      },
      [...DEMO_LIQUIDITY_BOOK, paperQuote!],
    );

    expect(route.eligibleQuotes.map((quote) => quote.quoteId)).toContain("paper-external-quote");
    expect(route.fills.map((fill) => fill.quoteId)).toContain("paper-external-quote");
  });

  it("excludes a paper prediction-market quote below the calculated minimum", () => {
    const paperQuote = buildPaperPredictionMarketQuote({
      enabled: true,
      outcomeId: "participant_2",
      decimalOdds: 2.1,
      availableStake: 1000,
    });
    const route = buildExecutionRoute(
      {
        outcomeId: "participant_2",
        requestedStake: 6000,
        minimumDecimalOdds: 2.2,
        userProbability: 0.5,
      },
      [...DEMO_LIQUIDITY_BOOK, paperQuote!],
    );

    expect(route.eligibleQuotes.map((quote) => quote.quoteId)).not.toContain("paper-external-quote");
    expect(route.fills.map((fill) => fill.quoteId)).not.toContain("paper-external-quote");
  });
});

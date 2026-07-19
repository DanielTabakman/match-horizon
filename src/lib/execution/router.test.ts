import { describe, expect, it } from "vitest";
import { DEMO_LIQUIDITY_BOOK } from "./demoLiquidity";
import {
  buildExecutionRoute,
  buildGenericExecutionRoute,
  type ExecutionIntent,
  type GenericExecutableQuote,
  type SimulatedQuote,
} from "./router";

const spainIntent: ExecutionIntent = {
  outcomeId: "participant_2",
  requestedStake: 5000,
  minimumDecimalOdds: 2.2,
  userProbability: 0.5,
};

describe("buildExecutionRoute", () => {
  it("fills the default Spain example best price first", () => {
    const route = buildExecutionRoute(spainIntent, DEMO_LIQUIDITY_BOOK);

    expect(route.fills).toMatchObject([
      { quoteId: "spain-a", venueLabel: "Paper Venue A", filledStake: 500, decimalOdds: 3.5 },
      { quoteId: "spain-b", venueLabel: "Paper Venue B", filledStake: 2000, decimalOdds: 3.42 },
      { quoteId: "spain-c", venueLabel: "Paper Venue C", filledStake: 2500, decimalOdds: 3.3 },
    ]);
    expect(route.filledStake).toBe(5000);
    expect(route.unfilledStake).toBe(0);
    expect(route.weightedAverageOdds).toBe(3.368);
    expect(route.estimatedGrossPayout).toBe(16840);
  });

  it("keeps the historical fixture route economically identical through the generic kernel", () => {
    const wrapperRoute = buildExecutionRoute(spainIntent, DEMO_LIQUIDITY_BOOK);
    const genericRoute = buildGenericExecutionRoute(
      { ...spainIntent, selectionId: spainIntent.outcomeId },
      DEMO_LIQUIDITY_BOOK.map((quote) => ({ ...quote, selectionId: quote.outcomeId })),
    );

    expect(genericRoute.fills.map((fill) => [fill.quoteId, fill.filledStake, fill.decimalOdds])).toEqual(
      wrapperRoute.fills.map((fill) => [fill.quoteId, fill.filledStake, fill.decimalOdds]),
    );
    expect(genericRoute.weightedAverageOdds).toBe(wrapperRoute.weightedAverageOdds);
    expect(genericRoute.estimatedGrossPayout).toBe(wrapperRoute.estimatedGrossPayout);
    expect(genericRoute.unfilledStake).toBe(wrapperRoute.unfilledStake);
  });

  it("excludes the 2.10 Spain quote when it is below the calculated minimum", () => {
    const route = buildExecutionRoute(spainIntent, DEMO_LIQUIDITY_BOOK);

    expect(route.eligibleQuotes.map((quote) => quote.quoteId)).not.toContain("spain-d");
    expect(route.fills.map((fill) => fill.quoteId)).not.toContain("spain-d");
  });

  it("supports partial fills at the last selected quote", () => {
    const route = buildExecutionRoute(
      { ...spainIntent, requestedStake: 3000 },
      DEMO_LIQUIDITY_BOOK,
    );

    expect(route.fills).toMatchObject([
      { quoteId: "spain-a", filledStake: 500 },
      { quoteId: "spain-b", filledStake: 2000 },
      { quoteId: "spain-c", filledStake: 500 },
    ]);
    expect(route.filledStake).toBe(3000);
    expect(route.unfilledStake).toBe(0);
  });

  it("reports unfilled stake when eligible liquidity is exhausted", () => {
    const route = buildExecutionRoute(
      { ...spainIntent, requestedStake: 6000, minimumDecimalOdds: 3.3 },
      DEMO_LIQUIDITY_BOOK,
    );

    expect(route.filledStake).toBe(5000);
    expect(route.unfilledStake).toBe(1000);
  });

  it("calculates expected value from the user's probability and filled stake", () => {
    const route = buildExecutionRoute(spainIntent, DEMO_LIQUIDITY_BOOK);

    expect(route.expectedValue).toBe(3420);
  });

  it("uses deterministic venue and quote ties after odds", () => {
    const tiedQuotes: SimulatedQuote[] = [
      quote("z-quote", "venue-beta", 3.1, 100),
      quote("b-quote", "venue-alpha", 3.1, 100),
      quote("a-quote", "venue-alpha", 3.1, 100),
      quote("best-quote", "venue-gamma", 3.2, 100),
    ];

    const route = buildExecutionRoute(
      { ...spainIntent, requestedStake: 400, minimumDecimalOdds: 3 },
      tiedQuotes,
    );

    expect(route.fills.map((fill) => fill.quoteId)).toEqual([
      "best-quote",
      "a-quote",
      "b-quote",
      "z-quote",
    ]);
  });

  it("rejects invalid stake, probability, odds, and liquidity", () => {
    expect(() => buildExecutionRoute({ ...spainIntent, requestedStake: 0 }, DEMO_LIQUIDITY_BOOK)).toThrow(
      /stake/,
    );
    expect(() => buildExecutionRoute({ ...spainIntent, userProbability: 0 }, DEMO_LIQUIDITY_BOOK)).toThrow(
      /probability/,
    );
    expect(() => buildExecutionRoute({ ...spainIntent, userProbability: 1.01 }, DEMO_LIQUIDITY_BOOK)).toThrow(
      /probability/,
    );
    expect(() => buildExecutionRoute({ ...spainIntent, minimumDecimalOdds: 1 }, DEMO_LIQUIDITY_BOOK)).toThrow(
      /odds/,
    );
    expect(() =>
      buildExecutionRoute(spainIntent, [{ ...DEMO_LIQUIDITY_BOOK[0], availableStake: 0 }]),
    ).toThrow(/liquidity/);
    expect(() =>
      buildExecutionRoute(spainIntent, [{ ...DEMO_LIQUIDITY_BOOK[0], decimalOdds: 1 }]),
    ).toThrow(/odds/);
  });
});

describe("buildGenericExecutionRoute", () => {
  const intent = {
    selectionId: "fifa-world-cup-2026-winner:argentina",
    requestedStake: 1000,
    minimumDecimalOdds: 2,
    userProbability: 0.55,
  };

  it("uses deterministic tie ordering for generic real venue quotes", () => {
    const route = buildGenericExecutionRoute(intent, [
      genericQuote("z", "venue-b", 2.5, 200),
      genericQuote("b", "venue-a", 2.5, 200),
      genericQuote("a", "venue-a", 2.5, 200),
      genericQuote("best", "venue-c", 2.6, 200),
    ]);

    expect(route.fills.map((fill) => fill.quoteId)).toEqual(["best", "a", "b", "z"]);
  });

  it("supports partial fill and minimum-price rejection generically", () => {
    const route = buildGenericExecutionRoute({ ...intent, requestedStake: 700, minimumDecimalOdds: 2.4 }, [
      genericQuote("low", "venue-a", 2.1, 1000),
      genericQuote("top", "venue-b", 2.5, 300),
      genericQuote("second", "venue-c", 2.45, 300),
    ]);

    expect(route.eligibleQuotes.map((quote) => quote.quoteId)).toEqual(["top", "second"]);
    expect(route.filledStake).toBe(600);
    expect(route.unfilledStake).toBe(100);
  });
});

function quote(quoteId: string, venueId: string, decimalOdds: number, availableStake: number): SimulatedQuote {
  return {
    quoteId,
    venueId,
    venueLabel: venueId.replace("-", " "),
    outcomeId: "participant_2",
    decimalOdds,
    availableStake,
  };
}

function genericQuote(
  quoteId: string,
  venueId: string,
  decimalOdds: number,
  availableStake: number,
): GenericExecutableQuote {
  return {
    quoteId,
    venueId,
    venueLabel: venueId,
    selectionId: "fifa-world-cup-2026-winner:argentina",
    decimalOdds,
    availableStake,
  };
}

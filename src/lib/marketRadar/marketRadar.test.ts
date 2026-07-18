import { describe, expect, it } from "vitest";
import type { ExternalMarketObservation, MarketMapping, ObservationWithMapping } from "./types";
import { mapObservation } from "./mappings";
import { buildMappedObservationPaperQuote, evaluatePaperEligibility } from "./paperRoute";
import {
  BUILT_IN_RECIPES,
  consensusProbability,
  calculateChangeMyMindThreshold,
  duelRecipes,
  evaluateRecipe,
  scoreObservation,
} from "./strategyEngine";
import {
  PYTHON_STRATEGY_LIMITS,
  buildPythonStrategyContext,
  enforcePythonAdvisoryRouteGate,
  validatePythonStrategyResult,
  validatePythonStrategyRunInput,
} from "./pythonStrategy";
import { validateMapping, validateObservation } from "./validation";
import { normalizeSxBetMarket } from "./sxBetNormalize";
import { normalizePolymarketOutcome } from "./polymarketNormalize";
import { RADAR_TXLINE_REFERENCE } from "./txlineReference";
import sxRawFixture from "../../../test-fixtures/market-radar/sx-bet-raw-sanitized.json";
import polymarketRawFixture from "../../../test-fixtures/market-radar/polymarket-raw-sanitized.json";

const now = Date.parse("2026-07-18T20:00:00.000Z");

describe("market radar contracts", () => {
  it("validates normalized observations", () => {
    expect(validateObservation(observation())).toMatchObject({ midpointProbability: 0.4 });
    expect(() => validateObservation(observation({ bestAskProbability: 1.4 }))).toThrow("bestAskProbability");
  });

  it("requires exact mappings to name the TxLINE fixture and outcome", () => {
    const mapping: MarketMapping = {
      id: "bad",
      txlineFixtureId: null,
      txlineOutcomeId: null,
      venueId: "venue",
      externalMarketId: "market",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain",
      equivalence: "exact",
      resolutionNotes: "Same result.",
      reviewedAt: "2026-07-18T00:00:00.000Z",
    };
    expect(() => validateMapping(mapping)).toThrow("Exact MarketMapping");
  });

  it("keeps the committed SX Spain mapping related, not paper executable", () => {
    const mapped = mapObservation(
      observation({
        venueId: "sx-bet",
        externalMarketId: "0xd3fa7bceaaccd813858b5b7ff33a2fba93cc7f05a583883719b9367cc94c10f4",
        externalOutcomeId: "outcome-one",
      }),
    );
    expect(mapped.routeState).toBe("mapped");
    expect(mapped.mapping?.equivalence).toBe("related");
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[0],
      observation: mapped,
      observations: [mapped],
      txlineReference: { participant_2: 0.6 },
      now,
    });
    const eligibility = evaluatePaperEligibility({ observation: mapped, evaluation, recipe: BUILT_IN_RECIPES[0], now });
    expect(buildMappedObservationPaperQuote({ observation: mapped, eligibility })).toBeNull();
  });

  it("allows only eligible exact mapped observations into the paper quote path with provenance", () => {
    const mapped = exactMappedObservation({ bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02 });
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[2],
      observation: mapped,
      observations: [mapped],
      userBeliefs: { "exact-map": 0.62 },
      now,
    });
    const eligibility = evaluatePaperEligibility({ observation: mapped, evaluation, recipe: BUILT_IN_RECIPES[2], now });
    const quote = buildMappedObservationPaperQuote({ observation: mapped, eligibility });
    expect(quote).toMatchObject({
      quoteId: "external:test-venue:market-1:yes",
      outcomeId: "participant_2",
      decimalOdds: 2,
      availableStake: 100,
      provenance: {
        venueId: "test-venue",
        externalMarketId: "market-1",
        externalOutcomeId: "yes",
        mappingId: "exact-map",
        observedAt: "2026-07-18T19:59:00.000Z",
      },
    });
  });

  it("rejects paper quotes until every dynamic eligibility gate passes", () => {
    const stale = exactMappedObservation({ bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02, observedAt: "2026-07-18T19:00:00.000Z" });
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[2],
      observation: stale,
      observations: [stale],
      userBeliefs: { "exact-map": 0.62 },
      now,
    });
    const rejected = evaluatePaperEligibility({ observation: stale, evaluation, recipe: BUILT_IN_RECIPES[2], now });
    expect(rejected.eligible).toBe(false);
    expect(rejected.reasons).toContain("requires a fresh observation within the selected recipe age gate");
    expect(buildMappedObservationPaperQuote({ observation: stale, eligibility: rejected })).toBeNull();
  });
});

describe("connector adapter contracts", () => {
  it("normalizes raw SX Bet orders with maker/taker orientation and USDC notional depth", () => {
    const [spain, field] = normalizeSxBetMarket(sxRawFixture.market, sxRawFixture.orders, "2026-07-18T20:00:00.000Z");
    expect(spain).toMatchObject({
      outcomeLabel: "Spain",
      bestBidProbability: 0.4,
      bestAskProbability: 0.45,
      availableBidSize: 135,
      availableAskSize: 183.33,
    });
    expect(spain.spreadProbability).toBeCloseTo(0.05);
    expect(field).toMatchObject({
      outcomeLabel: "Field",
      bestBidProbability: 0.55,
      bestAskProbability: 0.6,
      availableBidSize: 150,
      availableAskSize: 90,
    });
    expect(field.spreadProbability).toBeCloseTo(0.05);
  });

  it("normalizes raw Polymarket CLOB share size into USD top-of-book notional", () => {
    const normalized = normalizePolymarketOutcome(
      polymarketRawFixture.event,
      polymarketRawFixture.market,
      "yes-token",
      "Yes",
      0.44,
      polymarketRawFixture.book,
    );
    expect(normalized).toMatchObject({
      bestBidProbability: 0.43,
      bestAskProbability: 0.47,
      availableBidSize: 51.6,
      availableAskSize: 37.6,
      observedAt: "2026-07-18T20:00:00.000Z",
    });
    expect(normalized.midpointProbability).toBeCloseTo(0.45);
    expect(normalized.spreadProbability).toBeCloseTo(0.04);
  });

  it("does not treat Gamma liquidityNum as CLOB top-of-book depth when the book is missing", () => {
    const normalized = normalizePolymarketOutcome(
      polymarketRawFixture.event,
      polymarketRawFixture.market,
      "yes-token",
      "Yes",
      0.44,
      null,
    );
    expect(normalized.availableBidSize).toBeNull();
    expect(normalized.availableAskSize).toBeNull();
    expect(normalized.bestBidProbability).toBe(0.43);
    expect(normalized.bestAskProbability).toBe(0.47);
  });

  it("documents a common executable USD/USDC notional unit across connectors", () => {
    const [sx] = normalizeSxBetMarket(sxRawFixture.market, sxRawFixture.orders, "2026-07-18T20:00:00.000Z");
    const polymarket = normalizePolymarketOutcome(
      polymarketRawFixture.event,
      polymarketRawFixture.market,
      "yes-token",
      "Yes",
      0.44,
      polymarketRawFixture.book,
    );
    expect(sx.availableAskSize).toBeCloseTo(183.33);
    expect(polymarket.availableAskSize).toBeCloseTo(0.47 * 80);
  });

  it("uses the committed TxLINE replay market reference", () => {
    expect(RADAR_TXLINE_REFERENCE).toMatchObject({
      participant_1: 0.37272,
      draw: 0.31837,
      participant_2: 0.30893,
    });
  });
});

describe("python strategy contract", () => {
  it("validates advisory Python results", () => {
    expect(
      validatePythonStrategyResult({
        decision: "accept",
        score: 12.5,
        reasons: ["Edge cleared."],
        metrics: { edge: 0.08, mapped: true, note: "paper-only", empty: null },
        proposedMinimumOdds: 2.1,
      }),
    ).toMatchObject({ decision: "accept", score: 12.5 });
  });

  it("rejects invalid Python result schemas", () => {
    expect(() =>
      validatePythonStrategyResult({
        decision: "buy",
        score: 1,
        reasons: ["bad"],
        metrics: {},
      }),
    ).toThrow("decision");
    expect(() =>
      validatePythonStrategyResult({
        decision: "reject",
        score: 1,
        reasons: "bad",
        metrics: {},
      }),
    ).toThrow("reasons");
  });

  it("rejects oversized Python source and input", () => {
    const context = buildPythonStrategyContext({
      selectedObservation: exactMappedObservation(),
      observations: [exactMappedObservation()],
      selectedStrategyParameters: BUILT_IN_RECIPES[0],
      runMode: "selected-observation",
      now: "2026-07-18T20:00:00.000Z",
    });
    expect(() => validatePythonStrategyRunInput({ source: "x".repeat(PYTHON_STRATEGY_LIMITS.maximumSourceBytes + 1), context })).toThrow("64 KB");
  });

  it("keeps Python accept results advisory for non-exact mappings", () => {
    const contextOnly = { ...observation(), mapping: null, routeState: "context-only" as const };
    const result = enforcePythonAdvisoryRouteGate({
      selectedObservation: contextOnly,
      result: { decision: "accept", score: 99, reasons: ["Python likes it."], metrics: {}, proposedStake: 50 },
    });
    expect(result.decision).toBe("context-only");
    expect(result.proposedStake).toBeNull();
    expect(result.reasons.at(-1)).toContain("advisory");
  });
});

describe("interestingness and strategy recipes", () => {
  it("scores observations deterministically", () => {
    const score = scoreObservation({
      observation: exactMappedObservation(),
      observations: [exactMappedObservation(), peerObservation()],
      userBeliefs: { "exact-map": 0.62 },
      now,
    });
    expect(score.total).toBeGreaterThan(50);
    expect(score.breakdown.resolutionRiskPenalty).toBe(0);
  });

  it("returns null consensus for unrelated Yes markets", () => {
    const first = exactMappedObservation({
      venueId: "venue-a",
      externalMarketId: "market-a",
      externalOutcomeId: "yes",
      outcomeLabel: "Yes",
    });
    const unrelated = exactMappedObservation({
      venueId: "venue-b",
      externalMarketId: "market-b",
      externalOutcomeId: "yes",
      outcomeLabel: "Yes",
      midpointProbability: 0.8,
    });
    unrelated.mapping = {
      ...unrelated.mapping!,
      id: "unrelated-map",
      txlineFixtureId: "different-fixture",
      txlineOutcomeId: "participant_1",
      externalMarketId: "market-b",
    };
    expect(consensusProbability(first, [first, unrelated])).toBeNull();
  });

  it("compares only different venues in the same audited group", () => {
    const selected = exactMappedObservation({ venueId: "venue-a", externalMarketId: "market-a" });
    const peer = peerObservation();
    expect(consensusProbability(selected, [selected, peer])).toBeCloseTo(0.59);
  });

  it("evaluates the built-in recipes with explicit reasons", () => {
    const mapped = exactMappedObservation();
    const evaluations = BUILT_IN_RECIPES.map((recipe) =>
      evaluateRecipe({
        recipe,
        observation: mapped,
        observations: [mapped, peerObservation()],
        userBeliefs: { "exact-map": 0.62 },
        txlineReference: { participant_2: 0.6 },
        now,
      }),
    );
    expect(evaluations).toHaveLength(5);
    expect(evaluations.every((evaluation) => evaluation.acceptedReasons.length + evaluation.rejectedReasons.length > 0)).toBe(true);
  });

  it("explains context-only evaluations", () => {
    const result = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[0],
      observation: { ...observation(), mapping: null, routeState: "context-only" },
      observations: [],
      now,
    });
    expect(result.verdict).toBe("context-only");
    expect(result.contextOnlyReasons[0]).toContain("mapping is missing");
  });

  it("supports strategy duel and threshold calculations", () => {
    const mapped = exactMappedObservation({ spreadProbability: 0.14 });
    const duel = duelRecipes({
      left: BUILT_IN_RECIPES[2],
      right: BUILT_IN_RECIPES[0],
      observation: mapped,
      observations: [mapped, peerObservation()],
      userBeliefs: { "exact-map": 0.62 },
      txlineReference: { participant_2: 0.6 },
      now,
    });
    expect(duel.summary).toContain("while");
    const threshold = calculateChangeMyMindThreshold({
      recipe: BUILT_IN_RECIPES[2],
      observation: mapped,
      referenceProbability: 0.62,
    });
    expect(threshold.thresholdProbability).toBeCloseTo(0.58);
    expect(threshold.explanation).toContain("stops passing");
  });
});

function observation(overrides: Partial<ExternalMarketObservation> = {}): ExternalMarketObservation {
  return {
    venueId: "test-venue",
    venueLabel: "Test Venue",
    externalMarketId: "market-1",
    externalOutcomeId: "yes",
    title: "Spain wins",
    outcomeLabel: "Spain",
    category: "Soccer",
    sport: "Soccer",
    startsAt: "2026-07-20T20:00:00.000Z",
    closesAt: null,
    bestBidProbability: 0.38,
    bestAskProbability: 0.5,
    midpointProbability: 0.4,
    spreadProbability: 0.12,
    availableBidSize: 50,
    availableAskSize: 100,
    lastTradeProbability: 0.41,
    observedAt: "2026-07-18T19:59:00.000Z",
    sourceUrl: null,
    resolutionSummary: "Fixture result.",
    rawStatus: "active",
    ...overrides,
  };
}

function exactMappedObservation(overrides: Partial<ExternalMarketObservation> = {}): ObservationWithMapping {
  return {
    ...observation(overrides),
    mapping: {
      id: "exact-map",
      txlineFixtureId: "18237038",
      txlineOutcomeId: "participant_2",
      venueId: "test-venue",
      externalMarketId: "market-1",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain match result",
      equivalence: "exact",
      resolutionNotes: "Audited same fixture result.",
      reviewedAt: "2026-07-18T00:00:00.000Z",
    },
    routeState: "mapped",
  };
}

function peerObservation(): ObservationWithMapping {
  return {
    ...observation({
      venueId: "peer",
      venueLabel: "Peer",
      externalMarketId: "market-2",
      externalOutcomeId: "yes",
      bestBidProbability: 0.58,
      bestAskProbability: 0.6,
      midpointProbability: 0.59,
      spreadProbability: 0.02,
    }),
    mapping: {
      id: "peer-exact-map",
      txlineFixtureId: "18237038",
      txlineOutcomeId: "participant_2",
      venueId: "peer",
      externalMarketId: "market-2",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain match result",
      equivalence: "exact",
      resolutionNotes: "Audited same fixture result.",
      reviewedAt: "2026-07-18T00:00:00.000Z",
    },
    routeState: "mapped",
  };
}

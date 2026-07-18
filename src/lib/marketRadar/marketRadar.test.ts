import { describe, expect, it } from "vitest";
import type { ExternalMarketObservation, MarketMapping, ObservationWithMapping } from "./types";
import { mapObservation } from "./mappings";
import { buildMappedObservationPaperQuote } from "./paperRoute";
import {
  BUILT_IN_RECIPES,
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
    expect(buildMappedObservationPaperQuote({ observation: mapped })).toBeNull();
  });

  it("allows only exact mapped observations into the paper quote path with provenance", () => {
    const quote = buildMappedObservationPaperQuote({ observation: exactMappedObservation() });
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
    routeState: "paper-executable",
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
    mapping: null,
    routeState: "context-only",
  };
}

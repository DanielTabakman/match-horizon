import { describe, expect, it } from "vitest";
import type { ExternalMarketObservation, MarketMapping, ObservationWithMapping } from "./types";
import { mapObservation } from "./mappings";
import { buildMappedObservationPaperQuote, effectiveObservationRouteState, evaluatePaperEligibility } from "./paperRoute";
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
import {
  classifyMarketRelevance,
  observationMatchesMarketScope,
  sortScopedObservations,
  type MarketScope,
} from "./marketRelevance";
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

  it("keeps exact mapped observations mapped until dynamic gates pass", () => {
    const mapped = exactMappedObservation({ bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02 });
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[2],
      observation: mapped,
      observations: [mapped],
      now,
    });
    const eligibility = evaluatePaperEligibility({ observation: mapped, evaluation, recipe: BUILT_IN_RECIPES[2], now });
    expect(effectiveObservationRouteState({ observation: mapped, eligibility })).toBe("mapped");
  });

  it("promotes exact mapped observations to paper executable only when dynamic gates pass", () => {
    const mapped = exactMappedObservation({ bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02 });
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[2],
      observation: mapped,
      observations: [mapped],
      userBeliefs: { "exact-map": 0.62 },
      now,
    });
    const eligibility = evaluatePaperEligibility({ observation: mapped, evaluation, recipe: BUILT_IN_RECIPES[2], now });
    expect(effectiveObservationRouteState({ observation: mapped, eligibility })).toBe("paper-executable");
  });

  it("keeps stale exact mapped quotes mapped instead of paper executable", () => {
    const stale = exactMappedObservation({ bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02, observedAt: "2026-07-18T19:00:00.000Z" });
    const evaluation = evaluateRecipe({
      recipe: BUILT_IN_RECIPES[2],
      observation: stale,
      observations: [stale],
      userBeliefs: { "exact-map": 0.62 },
      now,
    });
    const eligibility = evaluatePaperEligibility({ observation: stale, evaluation, recipe: BUILT_IN_RECIPES[2], now });
    expect(effectiveObservationRouteState({ observation: stale, eligibility })).toBe("mapped");
  });

  it("filters paper executable observations by dynamic eligibility", () => {
    const eligible = exactMappedObservation({ externalMarketId: "eligible", bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02 });
    const stale = exactMappedObservation({ externalMarketId: "stale", bestAskProbability: 0.5, availableAskSize: 100, spreadProbability: 0.02, observedAt: "2026-07-18T19:00:00.000Z" });
    const contextOnly = { ...observation({ externalMarketId: "context" }), mapping: null, routeState: "context-only" as const };
    const observations = [eligible, stale, contextOnly];
    const paperExecutable = observations.filter((item) => {
      const evaluation = evaluateRecipe({
        recipe: BUILT_IN_RECIPES[2],
        observation: item,
        observations,
        userBeliefs: { "exact-map": 0.62 },
        now,
      });
      const eligibility = evaluatePaperEligibility({ observation: item, evaluation, recipe: BUILT_IN_RECIPES[2], now });
      return effectiveObservationRouteState({ observation: item, eligibility }) === "paper-executable";
    });
    expect(paperExecutable.map((item) => item.externalMarketId)).toEqual(["eligible"]);
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
      availableAskSize: 122.73,
    });
    expect(spain.spreadProbability).toBeCloseTo(0.05);
    expect(field).toMatchObject({
      outcomeLabel: "Field",
      bestBidProbability: 0.55,
      bestAskProbability: 0.6,
      availableBidSize: 150,
      availableAskSize: 202.5,
    });
    expect(field.spreadProbability).toBeCloseTo(0.05);
  });

  it("uses maker-to-opposite-taker capacity rather than the reciprocal", () => {
    const [takerSide] = normalizeSxBetMarket(
      sxRawFixture.market,
      [
        {
          marketHash: sxRawFixture.market.marketHash,
          totalBetSize: "1000000000",
          fillAmount: "0",
          pendingFillAmount: "0",
          percentageOdds: "20750000000000000000",
          baseToken: "USDC",
          isMakerBettingOutcomeOne: false,
          orderStatus: "ACTIVE",
        },
      ],
      "2026-07-18T20:00:00.000Z",
    );
    expect(takerSide.bestAskProbability).toBe(0.7925);
    expect(takerSide.availableAskSize).toBe(3819.28);
    expect(takerSide.availableAskSize).not.toBeCloseTo(261.83);
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
    expect(sx.availableAskSize).toBeCloseTo(122.73);
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

describe("market relevance presentation scope", () => {
  it("includes World Cup and soccer observations in the default scope", () => {
    expect(classifyMarketRelevance(observation({ category: "FIFA World Cup", sport: null, title: "Spain vs France" }))).toBe("world-cup-soccer");
    expect(classifyMarketRelevance(observation({ category: null, sport: "Soccer", title: "Inter Miami vs LAFC" }))).toBe("world-cup-soccer");
  });

  it("keeps other explicit sports out of the default soccer scope but inside all sports", () => {
    const nba = mappedObservation({ sport: "Basketball", category: "NBA", title: "Lakers vs Celtics" });
    expect(classifyMarketRelevance(nba)).toBe("other-sports");
    expect(observationMatchesMarketScope(nba, "world-cup-soccer")).toBe(false);
    expect(observationMatchesMarketScope(nba, "all-sports")).toBe(true);
  });

  it("excludes politics and crypto from sports scopes", () => {
    const politics = mappedObservation({ category: "Politics", sport: null, title: "Will the president win reelection?" });
    const crypto = mappedObservation({ category: "Crypto", sport: null, title: "Will Bitcoin hit 100k?" });
    expect(classifyMarketRelevance(politics)).toBe("non-sports");
    expect(classifyMarketRelevance(crypto)).toBe("non-sports");
    expect(observationMatchesMarketScope(politics, "all-sports")).toBe(false);
    expect(observationMatchesMarketScope(crypto, "all-sports")).toBe(false);
  });

  it("excludes geopolitical conflict markets from sports scopes", () => {
    const conflict = mappedObservation({
      category: "Geopolitics",
      sport: null,
      title: "China x India military clash by December 31, 2026?",
      resolutionSummary: "Military personnel will qualify only after a direct combat encounter.",
    });
    expect(classifyMarketRelevance(conflict)).toBe("non-sports");
    expect(observationMatchesMarketScope(conflict, "all-sports")).toBe(false);
  });

  it("does not treat ambiguous football as default soccer without association-football context", () => {
    const ambiguous = mappedObservation({ sport: "Football", category: null, title: "Team A vs Team B" });
    const nfl = mappedObservation({ sport: "Football", category: "NFL", title: "Bills vs Jets" });
    const premierLeague = mappedObservation({ sport: "Football", category: "Premier League", title: "Arsenal vs Chelsea" });
    expect(classifyMarketRelevance(ambiguous)).toBe("other-sports");
    expect(classifyMarketRelevance(nfl)).toBe("other-sports");
    expect(classifyMarketRelevance(premierLeague)).toBe("world-cup-soccer");
  });

  it("excludes generic yes/no markets without explicit sports context", () => {
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Will it happen?", outcomeLabel: "Yes" }))).toBe("non-sports");
  });

  it("prefers strong sports title signals over generic negative title keywords when metadata is not useful", () => {
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Will Ukraine qualify for the World Cup?" }))).toBe("world-cup-soccer");
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Combat sports: UFC main event" }))).toBe("other-sports");
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Fed Cup tennis" }))).toBe("other-sports");
  });

  it("handles generic Sports metadata without overriding explicit non-sport metadata", () => {
    const genericSports = mappedObservation({ sport: null, category: "Sports", title: "Team A vs Team B" });
    const sportsWorldCup = mappedObservation({ sport: null, category: "Sports", title: "Will France win the World Cup?" });
    const politicsWorldCup = mappedObservation({ sport: null, category: "Politics", title: "Will a World Cup leader summit happen?" });

    expect(classifyMarketRelevance(genericSports)).toBe("other-sports");
    expect(observationMatchesMarketScope(genericSports, "all-sports")).toBe(true);
    expect(classifyMarketRelevance(sportsWorldCup)).toBe("world-cup-soccer");
    expect(classifyMarketRelevance(politicsWorldCup)).toBe("non-sports");
    expect(observationMatchesMarketScope(politicsWorldCup, "all-sports")).toBe(false);
  });

  it("keeps generic politics, crypto, and yes/no examples excluded", () => {
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Will Trump win the election?" }))).toBe("non-sports");
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Will Bitcoin hit 100k?" }))).toBe("non-sports");
    expect(classifyMarketRelevance(observation({ sport: null, category: null, title: "Will it happen?" }))).toBe("non-sports");
  });

  it("applies scope behavior without deleting imported observations", () => {
    const soccer = mappedObservation({ sport: "Soccer", externalMarketId: "soccer" });
    const tennis = mappedObservation({ sport: "Tennis", category: "Tennis", externalMarketId: "tennis" });
    const politics = mappedObservation({ category: "Politics", sport: null, externalMarketId: "politics" });
    const observations = [soccer, tennis, politics];
    expect(scopedMarketIds(observations, "world-cup-soccer")).toEqual(["soccer"]);
    expect(scopedMarketIds(observations, "all-sports")).toEqual(["soccer", "tennis"]);
    expect(scopedMarketIds(observations, "all-imported")).toEqual(["soccer", "tennis", "politics"]);
    expect(observations).toHaveLength(3);
  });

  it("orders the default soccer scope by World Cup/FIFA, mappings, soccer, then score", () => {
    const fifa = rankedItem(mappedObservation({ category: "FIFA", externalMarketId: "fifa", mapping: null }), 1);
    const mapped = rankedItem(mappedObservation({ sport: "Soccer", externalMarketId: "mapped" }), 3);
    const soccerHighScore = rankedItem(mappedObservation({ sport: "Soccer", externalMarketId: "soccer-high", mapping: null }), 100);
    const soccerLowScore = rankedItem(mappedObservation({ sport: "Soccer", externalMarketId: "soccer-low", mapping: null }), 2);
    expect(sortScopedObservations([soccerLowScore, soccerHighScore, mapped, fifa], "world-cup-soccer").map((item) => item.observation.externalMarketId)).toEqual([
      "fifa",
      "mapped",
      "soccer-high",
      "soccer-low",
    ]);
  });

  it("keeps truthful scoped, filtered, and displayed counts", () => {
    const imported = [
      mappedObservation({ sport: "Soccer", externalMarketId: "soccer-1" }),
      mappedObservation({ sport: "Soccer", externalMarketId: "soccer-2", venueId: "polymarket" }),
      mappedObservation({ sport: "Basketball", category: "NBA", externalMarketId: "nba" }),
      mappedObservation({ category: "Crypto", sport: null, externalMarketId: "crypto" }),
    ];
    const scoped = imported.filter((item) => observationMatchesMarketScope(item, "world-cup-soccer"));
    const filtered = scoped.filter((item) => item.venueId === "test-venue");
    const displayed = filtered.slice(0, 30);
    expect({ imported: imported.length, scoped: scoped.length, filtered: filtered.length, displayed: displayed.length }).toEqual({
      imported: 4,
      scoped: 2,
      filtered: 1,
      displayed: 1,
    });
  });

  it("passes only the current scoped and filtered observations to Python filtered-batch mode", () => {
    const soccer = exactMappedObservation({ sport: "Soccer", externalMarketId: "soccer", availableAskSize: 100 });
    const shallowSoccer = exactMappedObservation({ sport: "Soccer", externalMarketId: "shallow", availableAskSize: 1 });
    const tennis = exactMappedObservation({ sport: "Tennis", category: "Tennis", externalMarketId: "tennis", availableAskSize: 100 });
    const currentScopedAndFiltered = [soccer, shallowSoccer, tennis]
      .filter((item) => observationMatchesMarketScope(item, "world-cup-soccer"))
      .filter((item) => (item.availableAskSize ?? 0) >= 50);
    const context = buildPythonStrategyContext({
      selectedObservation: tennis,
      observations: currentScopedAndFiltered,
      selectedStrategyParameters: BUILT_IN_RECIPES[0],
      runMode: "filtered-batch",
      now: "2026-07-18T20:00:00.000Z",
    });
    expect(context.observations.map((item) => item.externalMarketId)).toEqual(["soccer"]);
    expect(context.selectedObservation?.externalMarketId).toBe("tennis");
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

function mappedObservation(overrides: Partial<ExternalMarketObservation> & { mapping?: MarketMapping | null } = {}): ObservationWithMapping {
  const { mapping, ...observationOverrides } = overrides;
  return {
    ...observation(observationOverrides),
    mapping: mapping === undefined ? exactMappedObservation().mapping : mapping,
    routeState: mapping === null ? "context-only" : "mapped",
  };
}

function scopedMarketIds(observations: ObservationWithMapping[], scope: MarketScope): string[] {
  return observations.filter((item) => observationMatchesMarketScope(item, scope)).map((item) => item.externalMarketId);
}

function rankedItem(observation: ObservationWithMapping, score: number) {
  return {
    observation,
    score: { total: score },
  };
}

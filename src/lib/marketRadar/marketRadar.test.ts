import { afterEach, describe, expect, it, vi } from "vitest";
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
import { normalizeKalshiMarket } from "./kalshiNormalize";
import type { KalshiMarket, KalshiOrderbook } from "./kalshiNormalize";
import { buildRealExecutableQuotes, buildRealPaperRoute } from "./realQuotes";
import { RADAR_TXLINE_REFERENCE } from "./txlineReference";
import sxRawFixture from "../../../test-fixtures/market-radar/sx-bet-raw-sanitized.json";
import polymarketRawFixture from "../../../test-fixtures/market-radar/polymarket-raw-sanitized.json";
import kalshiRawFixture from "../../../test-fixtures/market-radar/kalshi-raw-sanitized.json";

const now = Date.parse("2026-07-18T20:00:00.000Z");
const kalshiMarket = kalshiRawFixture.markets[0] as KalshiMarket;
const kalshiOrderbook = kalshiRawFixture.orderbook as KalshiOrderbook;
const sxTargetMarketHash = "0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1";
const kalshiTargetTicker = "KXMENWORLDCUP-26-AR";
const polymarketTargetConditionId = "0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f";
const polymarketTargetTokenId = "18812649149814341758733697580460697418474693998558159483117100240528657629879";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.MARKET_RADAR_FORCE_FALLBACK;
});

describe("market radar contracts", () => {
  it("validates normalized observations", () => {
    expect(validateObservation(observation())).toMatchObject({ midpointProbability: 0.4 });
    expect(() => validateObservation(observation({ bestAskProbability: 1.4 }))).toThrow("bestAskProbability");
  });

  it("requires comparable mappings to name a canonical selection", () => {
    const mapping: MarketMapping = {
      id: "bad",
      canonicalSelectionId: null,
      txlineFixtureId: null,
      txlineOutcomeId: null,
      venueId: "venue",
      externalMarketId: "market",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain",
      equivalence: "settlement-exact",
      resolutionNotes: "Same result.",
      reviewedAt: "2026-07-18T00:00:00.000Z",
    };
    expect(() => validateMapping(mapping)).toThrow("canonical selection");
  });

  it("allows normal-completion comparable mappings without claiming settlement equivalence", () => {
    const mapping: MarketMapping = {
      id: "bad-rules",
      canonicalSelectionId: "world-cup:argentina",
      txlineFixtureId: null,
      txlineOutcomeId: null,
      venueId: "venue",
      externalMarketId: "market",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Argentina",
      equivalence: "normal-completion-comparable",
      resolutionNotes: "Comparable only under normal tournament completion.",
      reviewedAt: "2026-07-18T00:00:00.000Z",
    };
    expect(validateMapping(mapping)).toMatchObject({ equivalence: "normal-completion-comparable" });
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
      selectionId: "fixture-18237038:participant_2",
      decimalOdds: 2,
      availableStake: 100,
      provenance: {
        venueId: "test-venue",
        externalMarketId: "market-1",
        externalOutcomeId: "yes",
        mappingId: "exact-map",
        canonicalSelectionId: "fixture-18237038:participant_2",
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

  it("normalizes Kalshi YES bids and complementary YES asks from NO bids", () => {
    const [yes] = normalizeKalshiMarket(
      kalshiMarket,
      kalshiOrderbook,
      kalshiRawFixture.capturedAt,
    );
    expect(yes).toMatchObject({
      venueId: "kalshi",
      externalMarketId: "KXMENWORLDCUP-26-AR",
      externalOutcomeId: "yes",
      bestBidProbability: 0.417,
      bestAskProbability: 0.418,
      availableBidSize: 12655.61,
      availableAskSize: 184555.69,
      observedAt: "2026-07-19T03:00:00.000Z",
    });
  });

  it("normalizes Kalshi NO bids and complementary NO asks from YES bids", () => {
    const [, no] = normalizeKalshiMarket(
      kalshiMarket,
      kalshiOrderbook,
      kalshiRawFixture.capturedAt,
    );
    expect(no).toMatchObject({
      externalOutcomeId: "no",
      bestBidProbability: 0.582,
      bestAskProbability: 0.583,
      availableBidSize: 256965.11,
      availableAskSize: 17693.58,
    });
  });

  it("preserves fallback timestamp when Kalshi orderbook has no authoritative timestamp", () => {
    const [yes] = normalizeKalshiMarket(kalshiMarket, { orderbook_fp: { yes_dollars: [], no_dollars: [] } }, "2026-07-19T03:01:00.000Z");
    expect(yes.observedAt).toBe("2026-07-19T03:01:00.000Z");
    expect(yes.availableAskSize).toBeNull();
  });

  it("drops malformed Kalshi levels", () => {
    const [yes] = normalizeKalshiMarket(
      kalshiMarket,
      { orderbook_fp: { yes_dollars: [["bad", "10"] as [string, string]], no_dollars: [["0.6000", "bad"] as [string, string]] } },
      kalshiRawFixture.capturedAt,
    );
    expect(yes.bestBidProbability).toBe(0.417);
    expect(yes.availableAskSize).toBeNull();
  });
});

describe("real cross-venue quote construction", () => {
  it("groups comparable peers by canonical selection and routes partial live real fills", () => {
    const sx = exactMappedObservation({
      venueId: "sx-bet",
      venueLabel: "SX Bet",
      externalMarketId: "sx-argentina",
      bestAskProbability: 0.43,
      availableAskSize: 100,
    });
    sx.mapping = { ...sx.mapping!, canonicalSelectionId: "world-cup:argentina", externalMarketId: "sx-argentina", venueId: "sx-bet" };
    const kalshi = exactMappedObservation({
      venueId: "kalshi",
      venueLabel: "Kalshi",
      externalMarketId: "kalshi-argentina",
      bestAskProbability: 0.42,
      availableAskSize: 200,
    });
    kalshi.mapping = { ...kalshi.mapping!, canonicalSelectionId: "world-cup:argentina", externalMarketId: "kalshi-argentina", venueId: "kalshi" };
    const related = exactMappedObservation({
      venueId: "polymarket",
      externalMarketId: "spain",
      bestAskProbability: 0.5,
      availableAskSize: 1000,
    });
    related.mapping = { ...related.mapping!, canonicalSelectionId: "world-cup:spain", externalMarketId: "spain", venueId: "polymarket" };
    const result = buildRealExecutableQuotes({
      observations: [sx, kalshi, related],
      now,
      selectedCanonicalSelectionId: "world-cup:argentina",
      sourceStatuses: { "sx-bet": "live", kalshi: "live" },
    });
    expect(result.liveStatus).toBe("ready-multi-venue");
    expect(result.currentLiveQuotes.map((quote) => quote.venueId)).toEqual(["kalshi", "sx-bet"]);
    const route = buildRealPaperRoute(
      { selectionId: result.canonicalSelectionId!, requestedStake: 350, minimumDecimalOdds: 2, userProbability: 0.55 },
      result.currentLiveQuotes,
    );
    expect(route.filledStake).toBe(300);
    expect(route.unfilledStake).toBe(50);
    expect(route.fills.map((fill) => fill.venueLabel)).toEqual(["Kalshi", "SX Bet"]);
  });

  it("does not show an unrelated selected market's Argentina route", () => {
    const yesA = exactMappedObservation({ venueId: "venue-a", externalMarketId: "market-a", outcomeLabel: "Yes" });
    yesA.mapping = { ...yesA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a", externalMarketId: "market-a" };
    const yesB = exactMappedObservation({ venueId: "venue-b", externalMarketId: "market-b", outcomeLabel: "Yes" });
    yesB.mapping = { ...yesB.mapping!, canonicalSelectionId: "next-match:argentina", venueId: "venue-b", externalMarketId: "market-b" };
    const result = buildRealExecutableQuotes({ observations: [yesA, yesB], now, selectedCanonicalSelectionId: "next-match:argentina" });
    expect(result.liveStatus).toBe("single-venue");
    expect(result.currentLiveQuotes.map((quote) => quote.venueId)).toEqual(["venue-b"]);
  });

  it("asks for a comparable selected market before showing witness quotes", () => {
    const result = buildRealExecutableQuotes({ observations: [exactMappedObservation()], now, selectedCanonicalSelectionId: null });
    expect(result.liveStatus).toBe("no-comparable-overlap");
    expect(result.liveReason).toContain("Select a comparable mapped market");
  });

  it("preserves a single valid quote in the single-venue state", () => {
    const only = exactMappedObservation({ venueId: "venue-a", bestAskProbability: 0.5, availableAskSize: 100 });
    only.mapping = { ...only.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const result = buildRealExecutableQuotes({ observations: [only], now, selectedCanonicalSelectionId: "world-cup:argentina" });
    expect(result.liveStatus).toBe("single-venue");
    expect(result.currentLiveQuotes).toHaveLength(1);
  });

  it("routes two fresh peers when a third comparable peer is stale", () => {
    const freshA = exactMappedObservation({ venueId: "venue-a", bestAskProbability: 0.5, availableAskSize: 100 });
    freshA.mapping = { ...freshA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const freshB = exactMappedObservation({ venueId: "venue-b", bestAskProbability: 0.49, availableAskSize: 100 });
    freshB.mapping = { ...freshB.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-b" };
    const oldA = exactMappedObservation({ venueId: "venue-c", observedAt: "2026-07-17T19:00:00.000Z" });
    oldA.mapping = { ...oldA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-c" };
    const result = buildRealExecutableQuotes({
      observations: [freshA, freshB, oldA],
      now,
      selectedCanonicalSelectionId: "world-cup:argentina",
    });
    expect(result.liveStatus).toBe("ready-multi-venue");
    expect(result.currentLiveQuotes.map((quote) => quote.venueId)).toEqual(["venue-b", "venue-a"]);
  });

  it("rejects inactive markets before readiness", () => {
    const inactive = exactMappedObservation({ venueId: "venue-a", rawStatus: "closed" });
    inactive.mapping = { ...inactive.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const result = buildRealExecutableQuotes({ observations: [inactive], now, selectedCanonicalSelectionId: "world-cup:argentina" });
    expect(result.liveStatus).toBe("no-current-route");
  });

  it("keeps captured witness viewable after 24 hours without live routing", () => {
    const capturedA = exactMappedObservation({ venueId: "venue-a", observedAt: "2026-07-01T00:00:00.000Z", rawStatus: "captured:ACTIVE" });
    capturedA.mapping = { ...capturedA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const capturedB = exactMappedObservation({ venueId: "venue-b", observedAt: "2026-07-01T00:00:00.000Z", rawStatus: "captured:ACTIVE" });
    capturedB.mapping = { ...capturedB.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-b" };
    const result = buildRealExecutableQuotes({
      observations: [capturedA, capturedB],
      now,
      selectedCanonicalSelectionId: "world-cup:argentina",
      sourceStatuses: { "venue-a": "live", "venue-b": "live" },
    });
    expect(result.liveStatus).toBe("no-current-route");
    expect(result.capturedStatus).toBe("captured-witness");
    expect(result.capturedWitnessQuotes.every((quote) => quote.provenance.status === "captured")).toBe(true);
  });

  it("shows one current live venue independently from captured witness quotes", () => {
    const live = exactMappedObservation({ venueId: "venue-live", bestAskProbability: 0.5, availableAskSize: 100 });
    live.mapping = { ...live.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-live" };
    const capturedA = exactMappedObservation({ venueId: "venue-a", observedAt: "2026-07-01T00:00:00.000Z", rawStatus: "captured:ACTIVE" });
    capturedA.mapping = { ...capturedA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const capturedB = exactMappedObservation({ venueId: "venue-b", observedAt: "2026-07-01T00:00:00.000Z", rawStatus: "captured:ACTIVE" });
    capturedB.mapping = { ...capturedB.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-b" };
    const result = buildRealExecutableQuotes({
      observations: [live, capturedA, capturedB],
      now,
      selectedCanonicalSelectionId: "world-cup:argentina",
      sourceStatuses: { "venue-live": "live", "venue-a": "live", "venue-b": "live" },
    });
    expect(result.liveStatus).toBe("single-venue");
    expect(result.currentLiveQuotes.map((quote) => quote.venueId)).toEqual(["venue-live"]);
    expect(result.capturedStatus).toBe("captured-witness");
    expect(result.capturedWitnessQuotes.map((quote) => quote.venueId)).toEqual(["venue-a", "venue-b"]);
  });

  it("keeps stale live real quotes out of current routing", () => {
    const oldA = exactMappedObservation({ venueId: "venue-a", observedAt: "2026-07-17T19:00:00.000Z" });
    oldA.mapping = { ...oldA.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-a" };
    const oldB = { ...peerObservation(), observedAt: "2026-07-17T19:00:00.000Z" };
    oldB.mapping = { ...oldB.mapping!, canonicalSelectionId: "world-cup:argentina", venueId: "venue-b" };
    const result = buildRealExecutableQuotes({ observations: [oldA, oldB], now, selectedCanonicalSelectionId: "world-cup:argentina" });
    expect(result.liveStatus).toBe("quotes-stale");
    expect(result.currentLiveQuotes).toHaveLength(0);
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

describe("targeted real-venue witness imports", () => {
  it("keeps the SX Bet witness when it is outside the ordinary active-market slice", async () => {
    const fillerMarkets = Array.from({ length: 12 }, (_, index) => ({
      ...sxRawFixture.market,
      marketHash: `0xfiller${index}`,
      outcomeOneName: `Filler ${index}`,
      teamOneName: `Filler ${index}`,
    }));
    const targetMarket = {
      ...sxRawFixture.market,
      marketHash: sxTargetMarketHash,
      outcomeOneName: "Argentina",
      teamOneName: "Argentina",
      outcomeTwoName: "The Field",
      teamTwoName: "The Field",
      leagueLabel: "Outrights - World Cup",
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/markets/find")) {
        return jsonResponse({ status: "success", data: [targetMarket] });
      }
      if (url.includes("/markets/active")) {
        return jsonResponse({ status: "success", data: { markets: [...fillerMarkets, targetMarket] } });
      }
      const marketHash = new URL(url).searchParams.get("marketHashes");
      return jsonResponse({
        status: "success",
        data: sxRawFixture.orders.map((order) => ({ ...order, marketHash })),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("server-only", () => ({}));
    const { fetchSxBetObservations } = await import("./sxBetAdapter");

    const result = await fetchSxBetObservations();

    expect(result.health.status).toBe("live");
    const targetObservations = result.observations.filter((observation) => observation.externalMarketId === sxTargetMarketHash);
    expect(targetObservations).toHaveLength(2);
    expect(targetObservations.every((observation) => !observation.rawStatus.startsWith("captured:"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(`/markets/find?marketHashes=${sxTargetMarketHash}`))).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/orders?")).length).toBe(13);
  });

  it("keeps SX Bet general live data when the targeted witness call fails and appends captured target evidence", async () => {
    const fillerMarket = { ...sxRawFixture.market, marketHash: "0xfiller-live" };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/markets/active")) {
        return jsonResponse({ status: "success", data: { markets: [fillerMarket] } });
      }
      if (url.includes("/markets/find")) {
        return { ok: false, status: 500, statusText: "Target failed", json: async () => ({}) };
      }
      const marketHash = new URL(url).searchParams.get("marketHashes");
      return jsonResponse({
        status: "success",
        data: sxRawFixture.orders.map((order) => ({ ...order, marketHash })),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("server-only", () => ({}));
    const { fetchSxBetObservations } = await import("./sxBetAdapter");

    const result = await fetchSxBetObservations();

    expect(result.health.status).toBe("live");
    expect(result.observations.some((observation) => observation.externalMarketId === "0xfiller-live" && !observation.rawStatus.startsWith("captured:"))).toBe(true);
    expect(result.observations.filter((observation) => observation.externalMarketId === sxTargetMarketHash).every((observation) => observation.rawStatus.startsWith("captured:"))).toBe(true);
  });

  it("keeps the Kalshi witness when it is outside the ordinary binary-market slice", async () => {
    const fillerMarkets = Array.from({ length: 8 }, (_, index) => ({
      ...kalshiMarket,
      ticker: `KXMENWORLDCUP-26-FILL${index}`,
      title: `Will filler ${index} win the 2026 Men's World Cup?`,
      yes_sub_title: `Filler ${index}`,
      no_sub_title: `Filler ${index}`,
    }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/markets?")) {
        return jsonResponse({ markets: [...fillerMarkets, kalshiMarket] });
      }
      if (url.endsWith(`/markets/${kalshiTargetTicker}`)) {
        return jsonResponse({ market: kalshiMarket });
      }
      return jsonResponse(kalshiOrderbook);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("server-only", () => ({}));
    const { fetchKalshiObservations } = await import("./kalshiAdapter");

    const result = await fetchKalshiObservations();

    expect(result.health.status).toBe("live");
    const targetObservations = result.observations.filter((observation) => observation.externalMarketId === kalshiTargetTicker);
    expect(targetObservations).toHaveLength(2);
    expect(targetObservations.every((observation) => !observation.rawStatus.startsWith("captured:"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/markets/${kalshiTargetTicker}`))).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/orderbook")).length).toBe(9);
  });

  it("keeps Kalshi general live data when the targeted witness call fails and appends captured target evidence", async () => {
    const fillerMarket = {
      ...kalshiMarket,
      ticker: "KXMENWORLDCUP-26-FILL",
      title: "Will filler win the 2026 Men's World Cup?",
      yes_sub_title: "Filler",
      no_sub_title: "Filler",
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/markets?")) {
        return jsonResponse({ markets: [fillerMarket] });
      }
      if (url.endsWith(`/markets/${kalshiTargetTicker}`)) {
        return { ok: false, status: 500, statusText: "Target failed", json: async () => ({}) };
      }
      return jsonResponse(kalshiOrderbook);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("server-only", () => ({}));
    const { fetchKalshiObservations } = await import("./kalshiAdapter");

    const result = await fetchKalshiObservations();

    expect(result.health.status).toBe("live");
    expect(result.observations.some((observation) => observation.externalMarketId === "KXMENWORLDCUP-26-FILL" && !observation.rawStatus.startsWith("captured:"))).toBe(true);
    expect(result.observations.filter((observation) => observation.externalMarketId === kalshiTargetTicker).every((observation) => observation.rawStatus.startsWith("captured:"))).toBe(true);
  });

  it("keeps the Polymarket witness from the bounded slug read when it is outside the ordinary event slice", async () => {
    const fillerEvent = {
      ...polymarketRawFixture.event,
      markets: Array.from({ length: 10 }, (_, index) => ({
        ...polymarketRawFixture.market,
        conditionId: `0xfiller${index}`,
        question: `Will filler ${index} win?`,
        clobTokenIds: JSON.stringify([`yes-token-${index}`, `no-token-${index}`]),
      })),
    };
    const targetEvent = {
      ...polymarketRawFixture.event,
      slug: "world-cup-winner",
      title: "World Cup Winner",
      markets: [
        {
          ...polymarketRawFixture.market,
          conditionId: polymarketTargetConditionId,
          question: "Will Argentina win the 2026 FIFA World Cup?",
          clobTokenIds: JSON.stringify([polymarketTargetTokenId, "target-no-token"]),
          outcomes: JSON.stringify(["Yes", "No"]),
          active: true,
          closed: false,
        },
      ],
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/events/slug/world-cup-winner")) {
        return jsonResponse(targetEvent);
      }
      if (url.includes("/events?")) {
        return jsonResponse([fillerEvent]);
      }
      return jsonResponse(polymarketRawFixture.book);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("server-only", () => ({}));
    const { fetchPolymarketObservations } = await import("./polymarketAdapter");

    const result = await fetchPolymarketObservations();

    expect(result.health.status).toBe("live");
    expect(result.observations.some((observation) => observation.externalOutcomeId === polymarketTargetTokenId)).toBe(true);
    expect(result.observations.filter((observation) => observation.externalMarketId === polymarketTargetConditionId)).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/book?")).length).toBe(22);
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
      canonicalSelectionId: "fixture-18237038:participant_2",
      txlineFixtureId: "18237038",
      txlineOutcomeId: "participant_2",
      venueId: "test-venue",
      externalMarketId: "market-1",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain match result",
      equivalence: "settlement-exact",
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
      canonicalSelectionId: "fixture-18237038:participant_2",
      txlineFixtureId: "18237038",
      txlineOutcomeId: "participant_2",
      venueId: "peer",
      externalMarketId: "market-2",
      externalOutcomeId: "yes",
      normalizedOutcomeLabel: "Spain match result",
      equivalence: "settlement-exact",
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

function jsonResponse(value: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => value,
  };
}

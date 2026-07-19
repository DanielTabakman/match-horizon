import type { OutcomeQuote } from "../domain";
import type { GenericExecutableQuote } from "../execution/router";

export type ExternalMarketObservation = {
  venueId: string;
  venueLabel: string;
  externalMarketId: string;
  externalOutcomeId: string;
  title: string;
  outcomeLabel: string;
  category: string | null;
  sport: string | null;
  startsAt: string | null;
  closesAt: string | null;
  bestBidProbability: number | null;
  bestAskProbability: number | null;
  midpointProbability: number | null;
  spreadProbability: number | null;
  /**
   * Executable top-of-book notional in USD/USDC at the displayed probability.
   * SX Bet order stakes and Polymarket CLOB share sizes must be converted before
   * populating these fields so strategy gates compare a common unit.
   */
  availableBidSize: number | null;
  availableAskSize: number | null;
  lastTradeProbability: number | null;
  observedAt: string;
  sourceUrl: string | null;
  resolutionSummary: string | null;
  rawStatus: string;
};

export type MappingEquivalence = "exact" | "related" | "not-equivalent";

export type MarketMapping = {
  id: string;
  canonicalSelectionId: string | null;
  txlineFixtureId: string | null;
  txlineOutcomeId: OutcomeQuote["outcomeId"] | null;
  venueId: string;
  externalMarketId: string;
  externalOutcomeId: string;
  normalizedOutcomeLabel: string;
  equivalence: MappingEquivalence;
  resolutionNotes: string;
  reviewedAt: string;
};

export type ObservationRouteState = "context-only" | "mapped" | "paper-executable";

export type ObservationWithMapping = ExternalMarketObservation & {
  mapping: MarketMapping | null;
  routeState: ObservationRouteState;
};

export type PaperEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export type PaperRouteProvenance = {
  venueId: string;
  venueLabel: string;
  externalMarketId: string;
  externalOutcomeId: string;
  observedAt: string;
  mappingId: string;
  canonicalSelectionId: string;
  sourceUrl: string | null;
  status: "live" | "captured";
};

export type ProvenancedGenericQuote = GenericExecutableQuote & {
  provenance: PaperRouteProvenance;
};

export type ConnectorHealth = {
  venueId: string;
  venueLabel: string;
  status: "live" | "fallback" | "unavailable";
  importedCount: number;
  observedAt: string | null;
  message: string;
  latencyMs: number | null;
};

export type ConnectorResult = {
  health: ConnectorHealth;
  observations: ExternalMarketObservation[];
  usedFallback: boolean;
};

export type RadarSnapshot = {
  observedAt: string;
  observations: ObservationWithMapping[];
  health: ConnectorHealth[];
};

export type StrategyRecipe = {
  id: string;
  label: string;
  reference: "user-belief" | "txline" | "cross-venue-consensus";
  minimumEdge: number;
  maximumSpread: number | null;
  minimumDepth: number | null;
  maximumAgeMs: number | null;
  divergenceThreshold: number | null;
  sizing: "fixed" | "quarter-kelly" | "half-kelly" | "full-kelly" | "liquidity-fraction";
  stakeCap: number | null;
  requireExplicitMapping: boolean;
};

export type StrategyVerdict = "accepted" | "rejected" | "context-only";

export type StrategyEvaluation = {
  recipeId: string;
  recipeLabel: string;
  verdict: StrategyVerdict;
  acceptedReasons: string[];
  rejectedReasons: string[];
  contextOnlyReasons: string[];
  referenceProbability: number | null;
  edge: number | null;
  stake: number | null;
};

export type InterestingnessBreakdown = {
  liquidity: number;
  spread: number;
  freshness: number;
  extremeness: number;
  crossVenueDivergence: number;
  beliefDisagreement: number;
  resolutionRiskPenalty: number;
};

export type InterestingnessScore = {
  total: number;
  breakdown: InterestingnessBreakdown;
};

export type ThresholdCalculation = {
  currentAskProbability: number | null;
  currentAskDecimalOdds: number | null;
  thresholdProbability: number | null;
  thresholdDecimalOdds: number | null;
  explanation: string;
};

export type UserBeliefByMapping = Record<string, number>;
export type TxlineReferenceByOutcome = Partial<Record<OutcomeQuote["outcomeId"], number>>;

export type PythonStrategyDecision = "accept" | "reject" | "context-only";

export type PythonStrategyResult = {
  decision: PythonStrategyDecision;
  score: number | null;
  reasons: string[];
  metrics: Record<string, number | string | boolean | null>;
  proposedMinimumOdds?: number | null;
  proposedStake?: number | null;
};

export type PythonStrategyRunMode = "selected-observation" | "filtered-batch";

export type PythonStrategyContext = {
  selectedObservation: ObservationWithMapping | null;
  observations: ObservationWithMapping[];
  selectedMapping: MarketMapping | null;
  userProbability: number | null;
  txlineReference: TxlineReferenceByOutcome;
  selectedStrategyParameters: StrategyRecipe;
  evaluationTimestamp: string;
  runMode: PythonStrategyRunMode;
};

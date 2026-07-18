"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import replayCapture from "../test-fixtures/replay/france-spain-18237038.json";
import type { Fixture, MarketSnapshot, OutcomeQuote } from "../src/lib/domain";
import {
  compareBeliefsToMarket,
  formatDisagreementPoints,
  formatPercentage,
  type BeliefByOutcome,
} from "../src/lib/beliefComparison";
import type { EvaluationSnapshot, ReplayProjection } from "../src/lib/replay/controller";
import {
  freezeEvaluationSnapshot,
  projectReplay,
  settleExpression,
} from "../src/lib/replay/controller";
import type { MatchReplay } from "../src/lib/replay/types";
import { DEMO_LIQUIDITY_BOOK } from "../src/lib/execution/demoLiquidity";
import {
  calculateExpectedReturn,
  calculateFullKellyFraction,
  calculateKellySizingPolicy,
  calculatePricingPolicy,
  buildExecutionPlanKey,
  type ExecutionPlan,
  type KellyMultiplier,
} from "../src/lib/execution/pricing";
import { buildExecutionRoute, type ExecutionRoute } from "../src/lib/execution/router";
import {
  buildPaperPredictionMarketQuote,
  canBuildRouteWithPaperQuotePolicy,
  isValidPaperQuoteInput,
} from "../src/lib/execution/paperQuote";
import { STRATEGY_PRESETS, strategyPresetValues, type StrategyPresetId } from "../src/lib/strategies/presets";

export type SnapshotState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "unsupported-market"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; fixture: Fixture; market: MarketSnapshot };

type Props = {
  snapshot: SnapshotState;
};

const DEFAULT_BELIEF: BeliefByOutcome = {
  participant_1: 0.3,
  draw: 0.2,
  participant_2: 0.5,
};

const REPLAY = replayCapture as MatchReplay;
const REPLAY_SPEEDS = [1, 4] as const;

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function BeliefComparisonClient({ snapshot }: Props) {
  if (snapshot.status !== "ready") {
    return <StatePanel snapshot={snapshot} />;
  }

  return <ReadyComparison fixture={snapshot.fixture} market={snapshot.market} />;
}

function ReadyComparison({ fixture, market }: { fixture: Fixture; market: MarketSnapshot }) {
  const [belief, setBelief] = useState<BeliefByOutcome>(DEFAULT_BELIEF);
  const comparison = useMemo(() => compareBeliefsToMarket(market, belief), [belief, market]);
  const totalPercent = comparison.totalBelief * 100;
  const totalIsValid = comparison.isValid;
  const strongestPositive = totalIsValid ? comparison.strongestPositive : null;
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);

  function updateBelief(outcomeId: OutcomeQuote["outcomeId"], nextPercent: string) {
    const parsed = Number(nextPercent);
    if (!Number.isFinite(parsed)) {
      return;
    }

    setBelief((current) => ({
      ...current,
      [outcomeId]: Math.max(0, Math.min(100, parsed)) / 100,
    }));
  }

  return (
    <main className="shell">
      <section className="fixture-band" aria-labelledby="fixture-heading">
        <div>
          <p className="eyebrow">World Cup fixture</p>
          <h1 id="fixture-heading">
            {fixture.participant1} vs {fixture.participant2}
          </h1>
          <p className="muted">
            Fixture {fixture.fixtureId}
            {fixture.startsAt ? ` - ${formatTimestamp(fixture.startsAt)}` : ""}
          </p>
        </div>
        <div className="receipt">
          <span>TxLINE snapshot</span>
          <strong>{formatTimestamp(market.capturedAt)}</strong>
        </div>
      </section>

      <section className="comparison-grid" aria-label="Market and belief comparison">
        <div className="panel">
          <div className="panel-heading">
            <h2>Market probabilities</h2>
            <span>Three-way result</span>
          </div>
          <div className="outcome-list">
            {market.outcomes.map((outcome) => (
              <MarketRow key={outcome.outcomeId} outcome={outcome} />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Your belief</h2>
            <span className={totalIsValid ? "valid" : "invalid"}>
              Total {totalPercent.toFixed(1)}%
            </span>
          </div>
          <div className="belief-list">
            {comparison.outcomes.map((outcome) => (
              <label className="belief-row" key={outcome.outcomeId}>
                <span>{outcome.label}</span>
                <input
                  aria-label={`${outcome.label} belief probability`}
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.1"
                  type="number"
                  value={(belief[outcome.outcomeId] * 100).toString()}
                  onChange={(event) => updateBelief(outcome.outcomeId, event.target.value)}
                />
                <span>%</span>
              </label>
            ))}
          </div>
          {!totalIsValid ? (
            <p className="validation" role="alert">
              Enter a belief total of exactly 100% to compare outcomes.
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel results-panel" aria-label="Disagreement results">
        <div className="panel-heading">
          <h2>Disagreement</h2>
          <span>{totalIsValid ? "Calculated" : "Waiting for 100%"}</span>
        </div>
        <div className="result-table">
          <div className="result-row result-headings">
            <span>Outcome</span>
            <span>Market</span>
            <span>Your belief</span>
            <span>Difference</span>
          </div>
          {comparison.outcomes.map((outcome) => (
            <div className="result-row" key={outcome.outcomeId}>
              <span className="result-outcome">{outcome.label}</span>
              <span>
                <span className="result-label">Market</span>
                {formatPercentage(outcome.marketProbability)}
              </span>
              <span>
                <span className="result-label">Your belief</span>
                {formatPercentage(outcome.beliefProbability)}
              </span>
              <strong>
                <span className="result-label">Difference</span>
                {totalIsValid ? formatDisagreementPoints(outcome.disagreementPoints) : "-"}
              </strong>
            </div>
          ))}
        </div>
        <div className="strongest">
          <p className="eyebrow">Clearest available expression</p>
          {totalIsValid && comparison.strongestPositive ? (
            <>
              <h3>{comparison.strongestPositive.label} match result</h3>
              <p>
                Your belief is {formatDisagreementPoints(comparison.strongestPositive.disagreementPoints)} above the
                TxLINE market probability, making this the strongest positive disagreement in the three-way result
                market.
              </p>
            </>
          ) : (
            <>
              <h3>No positive disagreement</h3>
              <p>
                A result expression appears after your 100% belief assigns more probability than the market to at least
                one outcome.
              </p>
            </>
          )}
        </div>
      </section>

      <ExecutionAgentPanel
        strongestPositive={strongestPositive}
        plan={executionPlan}
        onPlanChange={setExecutionPlan}
      />

      <ReplayPanel
        market={market}
        belief={belief}
        canStart={totalIsValid && strongestPositive !== null && executionPlan !== null}
        executionPlan={executionPlan}
      />
    </main>
  );
}

function ExecutionAgentPanel({
  strongestPositive,
  plan,
  onPlanChange,
}: {
  strongestPositive: ReturnType<typeof compareBeliefsToMarket>["strongestPositive"];
  plan: ExecutionPlan | null;
  onPlanChange: (plan: ExecutionPlan | null) => void;
}) {
  const [requiredEdgePercent, setRequiredEdgePercent] = useState("10");
  const [bankroll, setBankroll] = useState("120000");
  const [kellyMultiplier, setKellyMultiplier] = useState<KellyMultiplier>("half");
  const [useKellySizing, setUseKellySizing] = useState(true);
  const [manualStake, setManualStake] = useState("5000");
  const [strategyPresetId, setStrategyPresetId] = useState<StrategyPresetId>("standard");
  const [includePaperQuote, setIncludePaperQuote] = useState(false);
  const [paperDecimalOdds, setPaperDecimalOdds] = useState("3.25");
  const [paperAvailableStake, setPaperAvailableStake] = useState("1000");
  const lastRouteKey = useRef<string | null>(null);
  const outcomeId = strongestPositive?.outcomeId ?? null;
  const userProbability = strongestPositive?.beliefProbability ?? null;
  const requiredEdge = Number(requiredEdgePercent) / 100;
  const parsedBankroll = Number(bankroll);
  const parsedManualStake = Number(manualStake);
  const parsedPaperDecimalOdds = Number(paperDecimalOdds);
  const parsedPaperAvailableStake = Number(paperAvailableStake);
  const selectedPreset = STRATEGY_PRESETS[strategyPresetId];
  const pricingPolicy = useMemo(() => {
    if (userProbability === null) {
      return null;
    }

    try {
      return calculatePricingPolicy(userProbability, requiredEdge);
    } catch {
      return null;
    }
  }, [requiredEdge, userProbability]);
  const kellyPolicy = useMemo(() => {
    if (userProbability === null) {
      return null;
    }

    try {
      return calculateKellySizingPolicy({
        userProbability,
        requiredEdge,
        bankroll: parsedBankroll,
        kellyMultiplier,
      });
    } catch {
      return null;
    }
  }, [kellyMultiplier, parsedBankroll, requiredEdge, userProbability]);
  const fullKellyFraction = pricingPolicy
    ? calculateFullKellyFraction(pricingPolicy.userProbability, pricingPolicy.minimumDecimalOdds)
    : null;
  const targetStake = useKellySizing ? kellyPolicy?.suggestedStake ?? Number.NaN : parsedManualStake;
  const routeKey = buildExecutionPlanKey({
    strategyPresetId,
    outcomeId,
    userProbability,
    requiredEdgePercent,
    bankroll,
    kellyMultiplier,
    sizingMode: useKellySizing ? "kelly" : "manual",
    manualStake,
    includePaperQuote,
    paperDecimalOdds,
    paperAvailableStake,
  });
  const paperQuote = buildPaperPredictionMarketQuote({
    enabled: includePaperQuote,
    outcomeId,
    decimalOdds: parsedPaperDecimalOdds,
    availableStake: parsedPaperAvailableStake,
  });
  const quoteBook = paperQuote ? [...DEMO_LIQUIDITY_BOOK, paperQuote] : DEMO_LIQUIDITY_BOOK;
  const outcomeQuotes = outcomeId
    ? quoteBook.filter((quote) => quote.outcomeId === outcomeId).sort(
        (left, right) =>
          right.decimalOdds - left.decimalOdds ||
          left.venueId.localeCompare(right.venueId) ||
          left.quoteId.localeCompare(right.quoteId),
      )
    : [];
  const baseCanBuild =
    strongestPositive !== null &&
    pricingPolicy !== null &&
    Number.isFinite(targetStake) &&
    targetStake > 0 &&
    (!useKellySizing || kellyPolicy !== null);
  const paperQuoteIsValid = isValidPaperQuoteInput(parsedPaperDecimalOdds, parsedPaperAvailableStake);
  const canBuild = canBuildRouteWithPaperQuotePolicy({
    baseCanBuild,
    includePaperQuote,
    paperQuoteIsValid,
  });

  useEffect(() => {
    if (lastRouteKey.current === null) {
      lastRouteKey.current = routeKey;
      return;
    }

    if (lastRouteKey.current !== routeKey) {
      lastRouteKey.current = routeKey;
      onPlanChange(null);
    }
  }, [routeKey, onPlanChange]);

  function buildRoute() {
    if (!strongestPositive || !pricingPolicy || !canBuild) {
      return;
    }

    const route = buildExecutionRoute(
      {
        outcomeId: strongestPositive.outcomeId,
        requestedStake: targetStake,
        minimumDecimalOdds: pricingPolicy.minimumDecimalOdds,
        userProbability: strongestPositive.beliefProbability,
      },
      quoteBook,
    );

    onPlanChange({
      pricing: pricingPolicy,
      sizingMode: useKellySizing ? "kelly" : "manual",
      bankroll: useKellySizing && kellyPolicy ? kellyPolicy.bankroll : null,
      kellyMultiplier: useKellySizing ? kellyMultiplier : null,
      fullKellyFraction: useKellySizing && kellyPolicy ? kellyPolicy.fullKellyFraction : fullKellyFraction ?? 0,
      appliedKellyFraction: useKellySizing && kellyPolicy ? kellyPolicy.appliedKellyFraction : 0,
      targetStake,
      route,
    });
  }

  function applyStrategyPreset(nextPresetId: StrategyPresetId) {
    setStrategyPresetId(nextPresetId);
    const presetValues = strategyPresetValues(nextPresetId);
    if (!presetValues) {
      return;
    }

    setRequiredEdgePercent(presetValues.requiredEdgePercent.toString());
    setKellyMultiplier(presetValues.kellyMultiplier);
    setUseKellySizing(presetValues.useKellySizing);
  }

  function setCustomRequiredEdge(value: string) {
    setStrategyPresetId("custom");
    setRequiredEdgePercent(value);
  }

  function setCustomKellyMultiplier(value: KellyMultiplier) {
    setStrategyPresetId("custom");
    setKellyMultiplier(value);
  }

  function setCustomUseKellySizing(value: boolean) {
    setStrategyPresetId("custom");
    setUseKellySizing(value);
  }

  return (
    <section className="panel execution-panel" aria-label="Execution Agent">
      <div className="panel-heading">
        <div>
          <h2>Execution Agent</h2>
          <span>Simulated liquidity routing</span>
        </div>
        <strong className="simulation-badge">Simulation only - no wager submitted</strong>
      </div>

      {strongestPositive ? (
        <>
          <div className="execution-summary">
            <Metric label="Selected outcome" value={`${strongestPositive.label} match result`} />
            <Metric label="Your probability" value={formatPercentage(strongestPositive.beliefProbability)} />
            <Metric
              label="Fair odds"
              value={pricingPolicy ? formatDecimalOdds(pricingPolicy.fairDecimalOdds) : "-"}
            />
            <Metric label="TxLINE probability" value={formatPercentage(strongestPositive.marketProbability)} />
            <Metric
              label="Probability disagreement"
              value={formatDisagreementPoints(strongestPositive.disagreementPoints)}
            />
          </div>

          <div className="execution-controls">
            <label>
              <span>Strategy preset</span>
              <select
                aria-label="Strategy preset"
                value={strategyPresetId}
                onChange={(event) => applyStrategyPreset(event.target.value as StrategyPresetId)}
              >
                <option value="standard">Standard</option>
                <option value="conservative">Conservative</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span>Required edge (%)</span>
              <input
                aria-label="Required edge percentage"
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={requiredEdgePercent}
                onChange={(event) => setCustomRequiredEdge(event.target.value)}
              />
            </label>
            <label>
              <span>Strategy bankroll</span>
              <input
                aria-label="Strategy bankroll"
                inputMode="decimal"
                min="1"
                step="1000"
                type="number"
                value={bankroll}
                onChange={(event) => setBankroll(event.target.value)}
              />
            </label>
            <label>
              <span>Kelly fraction</span>
              <select
                aria-label="Kelly fraction"
                value={kellyMultiplier}
                onChange={(event) => setCustomKellyMultiplier(event.target.value as KellyMultiplier)}
              >
                <option value="quarter">Quarter Kelly</option>
                <option value="half">Half Kelly</option>
                <option value="full">Full Kelly</option>
              </select>
            </label>
            <label className="toggle-control">
              <input
                aria-label="Use Kelly sizing"
                type="checkbox"
                checked={useKellySizing}
                onChange={(event) => setCustomUseKellySizing(event.target.checked)}
              />
              <span>Use Kelly sizing</span>
            </label>
            {!useKellySizing ? (
              <label>
                <span>Manual requested stake</span>
                <input
                  aria-label="Manual requested stake"
                  inputMode="decimal"
                  min="1"
                  step="100"
                  type="number"
                  value={manualStake}
                  onChange={(event) => setManualStake(event.target.value)}
                />
              </label>
            ) : null}
            <button type="button" onClick={buildRoute} disabled={!canBuild}>
              Build simulated route
            </button>
          </div>
          <p className="execution-disclaimer">
            {selectedPreset.description}
          </p>

          <div className="execution-totals pricing-policy">
            <Metric label="Fair odds" value={pricingPolicy ? formatDecimalOdds(pricingPolicy.fairDecimalOdds) : "-"} />
            <Metric
              label="Calculated minimum odds"
              value={pricingPolicy ? formatDecimalOdds(pricingPolicy.minimumDecimalOdds) : "-"}
            />
            <Metric
              label="Full Kelly"
              value={fullKellyFraction === null ? "-" : formatPrecisePercentage(fullKellyFraction)}
            />
            <Metric
              label={`Applied ${labelKellyMultiplier(kellyMultiplier)}`}
              value={kellyPolicy ? formatPrecisePercentage(kellyPolicy.appliedKellyFraction) : "-"}
            />
            <Metric
              label={useKellySizing ? "Suggested stake" : "Manual target stake"}
              value={Number.isFinite(targetStake) && targetStake > 0 ? formatCurrency(targetStake) : "-"}
            />
            <Metric label="Sizing mode" value={useKellySizing ? "Kelly" : "Manual"} />
          </div>
          <p className="execution-disclaimer">
            Required edge is the minimum expected return implied by your probability. Kelly sizing is an educational
            reference from your own belief, not a recommendation or guarantee.
          </p>

          <div className="paper-quote-panel">
            <label className="toggle-control">
              <input
                aria-label="Include paper prediction-market quote"
                type="checkbox"
                checked={includePaperQuote}
                onChange={(event) => setIncludePaperQuote(event.target.checked)}
              />
              <span>Include paper prediction-market quote</span>
            </label>
            <div className="paper-quote-controls">
              <label>
                <span>Paper decimal odds</span>
                <input
                  aria-label="Paper prediction-market decimal odds"
                  inputMode="decimal"
                  min="1.01"
                  step="0.01"
                  type="number"
                  value={paperDecimalOdds}
                  onChange={(event) => setPaperDecimalOdds(event.target.value)}
                />
              </label>
              <label>
                <span>Paper available size</span>
                <input
                  aria-label="Paper prediction-market available size"
                  inputMode="decimal"
                  min="1"
                  step="100"
                  type="number"
                  value={paperAvailableStake}
                  onChange={(event) => setPaperAvailableStake(event.target.value)}
                />
              </label>
            </div>
            <p className="execution-disclaimer">
              Manually entered paper data only. This is not a live market connection and cannot submit orders.
            </p>
            {includePaperQuote && !paperQuoteIsValid ? (
              <p className="validation" role="alert">
                Paper quote odds must be greater than 1 and available size must be greater than 0.
              </p>
            ) : null}
          </div>

          <div className="coming-soon-panel">
            <h3>Prediction-market connections &mdash; Coming soon</h3>
            <p>
              The paper quote uses the same normalized pricing and routing path planned for read-only
              prediction-market connectors. Future connectors will require explicit market and resolution-rule mapping
              before prices can be compared. No live market, wallet, or order submission is connected in this demo.
            </p>
          </div>

          <div className="execution-routing-grid">
            <div className="execution-table">
              <div className="panel-heading">
                <h3>Available simulated liquidity</h3>
                <span>{outcomeQuotes.length} quotes</span>
              </div>
              {outcomeQuotes.map((quote) => (
                <div className="execution-row" key={quote.quoteId}>
                  <span>{quote.venueLabel}</span>
                  <strong>{formatDecimalOdds(quote.decimalOdds)}</strong>
                  <span>{formatCurrency(quote.availableStake)}</span>
                  <span
                    className={
                      pricingPolicy && quote.decimalOdds >= pricingPolicy.minimumDecimalOdds ? "valid" : "invalid"
                    }
                  >
                    {pricingPolicy && quote.decimalOdds >= pricingPolicy.minimumDecimalOdds
                      ? "Eligible"
                      : "Below minimum"}
                  </span>
                </div>
              ))}
            </div>

            <div className="execution-table">
              <div className="panel-heading">
                <h3>Actual routed fills</h3>
                <span>{plan ? `${plan.route.fills.length} fills` : "Not built"}</span>
              </div>
              {plan && plan.route.fills.length > 0 ? (
                plan.route.fills.map((fill) => (
                  <div className="execution-row" key={fill.quoteId}>
                    <span>{fill.venueLabel}</span>
                    <strong>{formatDecimalOdds(fill.decimalOdds)}</strong>
                    <span>{formatCurrency(fill.filledStake)}</span>
                    <span>{formatCurrency(fill.estimatedGrossPayout)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">Build a route to allocate stake across eligible simulated quotes.</p>
              )}
            </div>
          </div>

          {plan ? (
            <div className="execution-totals">
              <Metric label="Requested" value={formatCurrency(plan.route.requestedStake)} />
              <Metric label="Filled" value={formatCurrency(plan.route.filledStake)} />
              <Metric label="Unfilled" value={formatCurrency(plan.route.unfilledStake)} />
              <Metric
                label="Weighted-average odds"
                value={
                  plan.route.weightedAverageOdds === null ? "-" : formatDecimalOdds(plan.route.weightedAverageOdds)
                }
              />
              <Metric label="Estimated gross payout" value={formatCurrency(plan.route.estimatedGrossPayout)} />
              <Metric
                label="Expected return at routed odds"
                value={
                  plan.route.weightedAverageOdds === null
                    ? "-"
                    : formatPercentage(calculateExpectedReturn(plan.pricing.userProbability, plan.route.weightedAverageOdds))
                }
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="validation" role="alert">
          Enter a valid 100% belief with at least one positive disagreement to build a simulated route.
        </p>
      )}
    </section>
  );
}

function ReplayPanel({
  market,
  belief,
  canStart,
  executionPlan,
}: {
  market: MarketSnapshot;
  belief: BeliefByOutcome;
  canStart: boolean;
  executionPlan: ExecutionPlan | null;
}) {
  const [snapshot, setSnapshot] = useState<EvaluationSnapshot | null>(null);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof REPLAY_SPEEDS)[number]>(4);
  const projection = useMemo<ReplayProjection>(() => projectReplay(REPLAY, cursor), [cursor]);
  const isComplete = projection.cursor >= REPLAY.events.length;
  const settlement =
    snapshot && projection.finalizedReceipt
      ? settleExpression(snapshot.selectedExpression, projection.finalizedReceipt, snapshot.market)
      : null;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setCursor((current) => {
        const next = Math.min(current + 1, REPLAY.events.length);
        if (next >= REPLAY.events.length) {
          window.clearInterval(interval);
          setIsPlaying(false);
        }

        return next;
      });
    }, Math.max(120, 700 / speed));

    return () => window.clearInterval(interval);
  }, [isPlaying, speed]);

  function startReplay() {
    const frozenSnapshot = freezeEvaluationSnapshot(market, belief, new Date().toISOString(), executionPlan);
    if (!frozenSnapshot) {
      return;
    }

    setSnapshot(frozenSnapshot);
    setCursor(0);
    setIsPlaying(true);
  }

  function restartReplay() {
    setCursor(0);
    setIsPlaying(Boolean(snapshot));
  }

  return (
    <section className="panel replay-panel" aria-label="Deterministic match replay">
      <div className="panel-heading replay-heading">
        <div>
          <h2>Deterministic replay</h2>
          <span>Committed offline France vs Spain fixture</span>
        </div>
        <span>{snapshot ? `Frozen ${formatTimestamp(snapshot.capturedAt)}` : "Ready to freeze expression"}</span>
      </div>

      <div className="replay-layout">
        <div className="scoreboard" aria-live="polite">
          <span>{REPLAY.fixture.participant1}</span>
          <strong>{formatScore(projection.score.score1)}</strong>
          <span>{REPLAY.fixture.participant2}</span>
          <strong>{formatScore(projection.score.score2)}</strong>
        </div>

        <div className="replay-controls">
          {!snapshot ? (
            <button type="button" onClick={startReplay} disabled={!canStart}>
              Start replay
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setIsPlaying(true)} disabled={isPlaying || isComplete}>
                Play
              </button>
              <button type="button" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>
                Pause
              </button>
              <button type="button" onClick={restartReplay}>
                Restart
              </button>
            </>
          )}
          <label className="speed-control">
            <span>Speed</span>
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value) as (typeof REPLAY_SPEEDS)[number])}
            >
              {REPLAY_SPEEDS.map((option) => (
                <option key={option} value={option}>
                  {option}x
                </option>
              ))}
            </select>
          </label>
        </div>

        {!canStart && !snapshot ? (
          <p className="validation" role="alert">
            Enter a valid 100% belief with at least one positive disagreement to start the replay.
            Build a simulated execution route before replay so the plan can be frozen.
          </p>
        ) : null}

        <div className="replay-note">
          Historical odds movement was not available from TxLINE for this completed fixture. The market probabilities
          stay fixed at the real initial snapshot.
        </div>

        {snapshot ? (
          <div className="frozen-expression">
            <p className="eyebrow">Frozen expression</p>
            <h3>{snapshot.strongestPositive.label} match result</h3>
            <p>
              Your original belief was {formatPercentage(snapshot.belief[snapshot.selectedExpression])}; TxLINE was{" "}
              {formatPercentage(snapshot.strongestPositive.marketProbability)}.
            </p>
            {snapshot.executionRoute ? (
              <p>
                Frozen simulated route filled {formatCurrency(snapshot.executionRoute.filledStake)} at{" "}
                {snapshot.executionRoute.weightedAverageOdds === null
                  ? "-"
                  : formatDecimalOdds(snapshot.executionRoute.weightedAverageOdds)}{" "}
                weighted-average odds.
              </p>
            ) : null}
            {snapshot.executionPlan ? (
              <p>
                Frozen policy: {formatPercentage(snapshot.executionPlan.pricing.userProbability)} belief,{" "}
                {formatPercentage(snapshot.executionPlan.pricing.requiredEdge)} required edge,{" "}
                {formatDecimalOdds(snapshot.executionPlan.pricing.minimumDecimalOdds)} minimum odds,{" "}
                {formatCurrency(snapshot.executionPlan.targetStake)} target stake.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="timeline" aria-label="Recent replay events">
          <div className="panel-heading">
            <h3>Recent events</h3>
            <span>
              {projection.cursor} / {REPLAY.events.length}
            </span>
          </div>
          {projection.recentEvents.length > 0 ? (
            <ol>
              {projection.recentEvents.map((event) => (
                <li key={event.key}>
                  <time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt)}</time>
                  <span>{event.label}</span>
                  <strong>{formatTimelineScore(event.score.score1, event.score.score2)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No replay events have been played yet.</p>
          )}
        </div>

        {snapshot && projection.finalizedReceipt && settlement ? (
          <ResultReceiptPanel
            snapshot={snapshot}
            projection={projection}
            settlement={settlement}
          />
        ) : null}
      </div>
    </section>
  );
}

function ResultReceiptPanel({
  snapshot,
  projection,
  settlement,
}: {
  snapshot: EvaluationSnapshot;
  projection: ReplayProjection;
  settlement: { label: string; occurred: boolean };
}) {
  const receipt = projection.finalizedReceipt;
  if (!receipt) {
    return null;
  }

  return (
    <>
      <div className="result-receipt">
        <div className="panel-heading">
          <h3>Result receipt</h3>
          <span>{settlement.occurred ? "Expression occurred" : "Expression did not occur"}</span>
        </div>
        <dl>
          <ReceiptRow
            label="Fixture and final score"
            value={`${REPLAY.fixture.participant1} ${receipt.finalScore1}-${receipt.finalScore2} ${REPLAY.fixture.participant2}`}
          />
          <ReceiptRow label="Original user probabilities" value={formatOutcomeSet(snapshot.belief, snapshot.market)} />
          <ReceiptRow
            label="Initial TxLINE market probabilities"
            value={formatOutcomeSet(
              {
                participant_1: snapshot.market.outcomes[0].probability,
                draw: snapshot.market.outcomes[1].probability,
                participant_2: snapshot.market.outcomes[2].probability,
              },
              snapshot.market,
            )}
          />
          <ReceiptRow label="Selected expression and outcome" value={`${settlement.label} match result: ${settlement.occurred ? "occurred" : "did not occur"}`} />
          <ReceiptRow label="TxLINE data received" value="yes" />
          <ReceiptRow label="Proof available" value="no" />
          <ReceiptRow label="Proof structure checked" value="no" />
          <ReceiptRow label="On-chain validated" value="no" />
        </dl>
      </div>

      {snapshot.executionRoute ? (
        <SimulatedSettlementPanel
          route={snapshot.executionRoute}
          plan={snapshot.executionPlan}
          selectedOutcome={`${settlement.label} match result`}
          occurred={settlement.occurred}
        />
      ) : null}
    </>
  );
}

function SimulatedSettlementPanel({
  route,
  plan,
  selectedOutcome,
  occurred,
}: {
  route: ExecutionRoute;
  plan: ExecutionPlan | null;
  selectedOutcome: string;
  occurred: boolean;
}) {
  const simulatedGrossReturn = occurred ? route.estimatedGrossPayout : 0;
  const simulatedProfitLoss = simulatedGrossReturn - route.filledStake;

  return (
    <div className="simulated-settlement">
      <div className="panel-heading">
        <h3>Simulated execution settlement</h3>
        <span>Simulation only - no wager submitted</span>
      </div>
      <dl>
        <ReceiptRow label="Selected outcome" value={selectedOutcome} />
        {plan ? (
          <>
            <ReceiptRow
              label="Frozen pricing policy"
              value={`${formatPercentage(plan.pricing.userProbability)} belief | ${formatPercentage(
                plan.pricing.requiredEdge,
              )} required edge | ${formatDecimalOdds(plan.pricing.minimumDecimalOdds)} minimum odds`}
            />
            <ReceiptRow
              label="Frozen sizing policy"
              value={
                plan.sizingMode === "kelly"
                  ? `${labelKellyMultiplier(plan.kellyMultiplier)} Kelly from ${formatCurrency(
                      plan.bankroll ?? 0,
                    )} bankroll | ${formatPrecisePercentage(plan.fullKellyFraction)} full | ${formatPrecisePercentage(
                      plan.appliedKellyFraction,
                    )} applied`
                  : `Manual target stake ${formatCurrency(plan.targetStake)}`
              }
            />
          </>
        ) : null}
        <ReceiptRow label="Filled stake" value={formatCurrency(route.filledStake)} />
        <ReceiptRow
          label="Weighted-average odds"
          value={route.weightedAverageOdds === null ? "-" : formatDecimalOdds(route.weightedAverageOdds)}
        />
        <ReceiptRow label="Expression occurred" value={occurred ? "yes" : "no"} />
        <ReceiptRow label="Simulated gross return" value={formatCurrency(simulatedGrossReturn)} />
        <ReceiptRow label="Simulated profit or loss" value={formatSignedCurrency(simulatedProfitLoss)} />
      </dl>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function MarketRow({ outcome }: { outcome: OutcomeQuote }) {
  return (
    <div className="market-row">
      <span>{outcome.label}</span>
      <strong>{formatPercentage(outcome.probability)}</strong>
      <meter min="0" max="1" value={outcome.probability} aria-label={`${outcome.label} market probability`} />
    </div>
  );
}

function formatTimestamp(value: string): string {
  return `${timestampFormatter.format(new Date(value))} UTC`;
}

function formatScore(score: number | null): string {
  return score === null ? "Unknown" : score.toString();
}

function formatTimelineScore(score1: number | null, score2: number | null): string {
  if (score1 === null || score2 === null) {
    return "Score not observed";
  }

  return `${score1}-${score2}`;
}

function formatOutcomeSet(values: BeliefByOutcome, market: MarketSnapshot): string {
  return market.outcomes
    .map((outcome) => `${outcome.label} ${formatPercentage(values[outcome.outcomeId])}`)
    .join(" | ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatPrecisePercentage(probability: number): string {
  return `${(probability * 100).toFixed(2)}%`;
}

function formatDecimalOdds(value: number): string {
  return value.toFixed(2);
}

function labelKellyMultiplier(multiplier: KellyMultiplier | null): string {
  if (multiplier === "quarter") {
    return "Quarter";
  }

  if (multiplier === "full") {
    return "Full";
  }

  return "Half";
}

function StatePanel({ snapshot }: { snapshot: Exclude<SnapshotState, { status: "ready" }> }) {
  const copy = {
    loading: ["Loading fixture", "Fetching the committed TxLINE snapshot."],
    empty: ["No fixture available", "The committed fixture snapshot did not contain the demo World Cup fixture."],
    "unsupported-market": ["Unsupported market", snapshot.status === "unsupported-market" ? snapshot.message : ""],
    error: ["Snapshot error", snapshot.status === "error" ? snapshot.message : ""],
  }[snapshot.status];

  return (
    <main className="shell state-shell">
      <section className="panel state-panel" aria-live="polite">
        <p className="eyebrow">Match Horizon</p>
        <h1>{copy[0]}</h1>
        <p className="muted">{copy[1]}</p>
      </section>
    </main>
  );
}

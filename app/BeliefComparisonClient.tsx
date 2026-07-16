"use client";

import { useEffect, useMemo, useState } from "react";
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
  participant_1: 0.4,
  draw: 0.25,
  participant_2: 0.35,
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

      <ReplayPanel market={market} belief={belief} canStart={totalIsValid && comparison.strongestPositive !== null} />
    </main>
  );
}

function ReplayPanel({
  market,
  belief,
  canStart,
}: {
  market: MarketSnapshot;
  belief: BeliefByOutcome;
  canStart: boolean;
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
    const frozenSnapshot = freezeEvaluationSnapshot(market, belief, new Date().toISOString());
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

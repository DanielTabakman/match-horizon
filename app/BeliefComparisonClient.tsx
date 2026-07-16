"use client";

import { useMemo, useState } from "react";
import type { Fixture, MarketSnapshot, OutcomeQuote } from "../src/lib/domain";
import {
  compareBeliefsToMarket,
  formatDisagreementPoints,
  formatPercentage,
  type BeliefByOutcome,
} from "../src/lib/beliefComparison";

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
            {fixture.startsAt ? ` - ${new Date(fixture.startsAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="receipt">
          <span>TxLINE snapshot</span>
          <strong>{new Date(market.capturedAt).toLocaleString()}</strong>
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
          {comparison.outcomes.map((outcome) => (
            <div className="result-row" key={outcome.outcomeId}>
              <span>{outcome.label}</span>
              <span>{formatPercentage(outcome.marketProbability)}</span>
              <span>{formatPercentage(outcome.beliefProbability)}</span>
              <strong>{totalIsValid ? formatDisagreementPoints(outcome.disagreementPoints) : "-"}</strong>
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
    </main>
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RadarSnapshot, StrategyRecipe, UserBeliefByMapping } from "../../src/lib/marketRadar/types";
import {
  BUILT_IN_RECIPES,
  DEFAULT_CUSTOM_RECIPE,
  calculateChangeMyMindThreshold,
  duelRecipes,
  evaluateRecipe,
  scoreObservation,
} from "../../src/lib/marketRadar/strategyEngine";
import { buildMappedObservationPaperQuote } from "../../src/lib/marketRadar/paperRoute";

type Props = { initialSnapshot: RadarSnapshot };

const TXLINE_REFERENCE = { participant_1: 0.317, draw: 0.276, participant_2: 0.407 };
const routeLabels = { "context-only": "Context only", mapped: "Mapped", "paper-executable": "Paper executable" };

export default function RadarClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [venue, setVenue] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [text, setText] = useState("");
  const [minimumLiquidity, setMinimumLiquidity] = useState("0");
  const [selectedRecipeId, setSelectedRecipeId] = useState("stale-market");
  const [duelRecipeId, setDuelRecipeId] = useState("liquidity-sweep");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [userBeliefs, setUserBeliefs] = useState<UserBeliefByMapping>({});
  const [customRecipe, setCustomRecipe] = useState<StrategyRecipe>(() => {
    if (typeof window === "undefined") return DEFAULT_CUSTOM_RECIPE;
    const saved = window.localStorage.getItem("match-horizon:radar-custom-recipe");
    if (!saved) return DEFAULT_CUSTOM_RECIPE;
    try {
      return { ...DEFAULT_CUSTOM_RECIPE, ...JSON.parse(saved) };
    } catch {
      window.localStorage.removeItem("match-horizon:radar-custom-recipe");
      return DEFAULT_CUSTOM_RECIPE;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("match-horizon:radar-custom-recipe", JSON.stringify(customRecipe));
  }, [customRecipe]);

  const recipes = useMemo(() => [...BUILT_IN_RECIPES, customRecipe], [customRecipe]);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0];
  const duelRecipe = recipes.find((recipe) => recipe.id === duelRecipeId) ?? recipes[1];
  const categories = useMemo(
    () => Array.from(new Set(snapshot.observations.map((item) => item.category ?? item.sport ?? "Uncategorized"))).sort(),
    [snapshot.observations],
  );
  const ranked = useMemo(
    () =>
      snapshot.observations
        .map((observation) => ({
          observation,
          score: scoreObservation({ observation, observations: snapshot.observations, userBeliefs }),
          evaluation: evaluateRecipe({
            recipe: selectedRecipe,
            observation,
            observations: snapshot.observations,
            userBeliefs,
            txlineReference: TXLINE_REFERENCE,
          }),
        }))
        .sort((left, right) => right.score.total - left.score.total),
    [selectedRecipe, snapshot.observations, userBeliefs],
  );
  const filtered = ranked.filter(({ observation }) => {
    const haystack = `${observation.title} ${observation.outcomeLabel} ${observation.venueLabel}`.toLowerCase();
    const liquidity = Math.max(observation.availableAskSize ?? 0, observation.availableBidSize ?? 0);
    const categoryLabel = observation.category ?? observation.sport ?? "Uncategorized";
    return (
      (venue === "all" || observation.venueId === venue) &&
      (status === "all" || observation.routeState === status) &&
      (category === "all" || categoryLabel === category) &&
      (!text || haystack.includes(text.toLowerCase())) &&
      liquidity >= Number(minimumLiquidity || 0)
    );
  });
  const selected = filtered.find(({ observation }) => keyFor(observation) === selectedKey) ?? filtered[0] ?? null;
  const selectedEvaluation = selected
    ? evaluateRecipe({
        recipe: selectedRecipe,
        observation: selected.observation,
        observations: snapshot.observations,
        userBeliefs,
        txlineReference: TXLINE_REFERENCE,
      })
    : null;
  const threshold = selected && selectedEvaluation
    ? calculateChangeMyMindThreshold({
        recipe: selectedRecipe,
        observation: selected.observation,
        referenceProbability: selectedEvaluation.referenceProbability,
      })
    : null;
  const duel = selected
    ? duelRecipes({
        left: selectedRecipe,
        right: duelRecipe,
        observation: selected.observation,
        observations: snapshot.observations,
        userBeliefs,
        txlineReference: TXLINE_REFERENCE,
      })
    : null;
  const paperQuote = selected ? buildMappedObservationPaperQuote({ observation: selected.observation }) : null;

  async function refresh() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      setSnapshot((await response.json()) as RadarSnapshot);
    } finally {
      setIsRefreshing(false);
    }
  }

  function updateBelief(value: string) {
    if (!selected?.observation.mapping) return;
    const parsed = Number(value);
    setUserBeliefs((current) => ({
      ...current,
      [selected.observation.mapping!.id]: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) / 100 : 0,
    }));
  }

  return (
    <main className="shell radar-shell">
      <section className="radar-topbar">
        <div>
          <p className="eyebrow">Market Radar</p>
          <h1>Read-only external market intelligence</h1>
          <p className="muted">
            Live connector observations, explicit mappings, transparent scoring, and paper-only strategy recipes.
          </p>
        </div>
        <div className="radar-actions">
          <Link href="/">Judge flow</Link>
          <button type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="health-grid" aria-label="Source health">
        {snapshot.health.map((health) => (
          <div className={`health-card ${health.status}`} key={health.venueId}>
            <span>{health.venueLabel}</span>
            <strong>{health.status === "fallback" ? "Fixture fallback" : health.status}</strong>
            <p>{health.message}</p>
            <small>{health.importedCount} imported{health.latencyMs !== null ? ` | ${health.latencyMs}ms` : ""}</small>
          </div>
        ))}
      </section>

      <section className="radar-filters" aria-label="Radar filters">
        <select value={venue} onChange={(event) => setVenue(event.target.value)} aria-label="Venue filter">
          <option value="all">All venues</option>
          <option value="sx-bet">SX Bet</option>
          <option value="polymarket">Polymarket</option>
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
          <option value="all">All sports/categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Mapping state filter">
          <option value="all">All mapping states</option>
          <option value="context-only">Context only</option>
          <option value="mapped">Mapped</option>
          <option value="paper-executable">Paper executable</option>
        </select>
        <input aria-label="Search observations" placeholder="Search title, outcome, venue" value={text} onChange={(event) => setText(event.target.value)} />
        <input aria-label="Minimum liquidity" inputMode="decimal" min="0" type="number" value={minimumLiquidity} onChange={(event) => setMinimumLiquidity(event.target.value)} />
      </section>

      <section className="radar-layout">
        <div className="radar-cards" aria-label="Ranked market observations">
          {filtered.slice(0, 30).map(({ observation, score, evaluation }) => (
            <button
              type="button"
              className={`radar-card ${selected && keyFor(selected.observation) === keyFor(observation) ? "selected" : ""}`}
              key={keyFor(observation)}
              onClick={() => setSelectedKey(keyFor(observation))}
            >
              <div className="card-line"><span>{observation.venueLabel}</span><strong>{score.total.toFixed(1)}</strong></div>
              <h2>{observation.title}</h2>
              <p>{observation.outcomeLabel}</p>
              <div className="tag-row"><span>{routeLabels[observation.routeState]}</span><span>{evaluation.verdict.replace("-", " ")}</span></div>
              <div className="metrics-row">
                <Metric label="Prob" value={fmtProb(observation.midpointProbability ?? observation.bestAskProbability)} />
                <Metric label="Spread" value={fmtProb(observation.spreadProbability)} />
                <Metric label="Depth" value={fmtSize(Math.max(observation.availableAskSize ?? 0, observation.availableBidSize ?? 0))} />
                <Metric label="Age" value={fmtAge(observation.observedAt)} />
              </div>
              <div className="score-bars">
                {Object.entries(score.breakdown).map(([label, value]) => <span key={label}>{label}: {value.toFixed(2)}</span>)}
              </div>
            </button>
          ))}
        </div>

        <aside className="strategy-panel" aria-label="Strategy Lab">
          <div className="panel-heading"><div><h2>Strategy Lab</h2><span>{selected ? selected.observation.outcomeLabel : "No observation selected"}</span></div></div>
          <label><span>Recipe</span><select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select></label>
          {selectedRecipeId === "custom" ? (
            <div className="custom-recipe">
              <label><span>Minimum edge (%)</span><input type="number" value={(customRecipe.minimumEdge * 100).toString()} onChange={(event) => setCustomRecipe({ ...customRecipe, minimumEdge: Number(event.target.value) / 100 })} /></label>
              <label><span>Maximum spread (%)</span><input type="number" value={customRecipe.maximumSpread === null ? "" : (customRecipe.maximumSpread * 100).toString()} onChange={(event) => setCustomRecipe({ ...customRecipe, maximumSpread: Number(event.target.value) / 100 })} /></label>
              <label><span>Minimum depth</span><input type="number" value={customRecipe.minimumDepth ?? 0} onChange={(event) => setCustomRecipe({ ...customRecipe, minimumDepth: Number(event.target.value) })} /></label>
            </div>
          ) : null}
          {selected?.observation.mapping ? (
            <label><span>User belief for this mapping (%)</span><input inputMode="decimal" min="0" max="100" type="number" value={((userBeliefs[selected.observation.mapping.id] ?? 0) * 100).toString()} onChange={(event) => updateBelief(event.target.value)} /></label>
          ) : <p className="radar-note">No mapping exists, so user-belief gates remain context-only.</p>}

          {selectedEvaluation ? (
            <div className={`evaluation ${selectedEvaluation.verdict}`}>
              <strong>{selectedEvaluation.verdict.replace("-", " ")}</strong>
              {[...selectedEvaluation.acceptedReasons, ...selectedEvaluation.rejectedReasons, ...selectedEvaluation.contextOnlyReasons].map((reason) => <p key={reason}>{reason}</p>)}
              <Metric label="Reference" value={fmtProb(selectedEvaluation.referenceProbability)} />
              <Metric label="Edge" value={fmtSignedProb(selectedEvaluation.edge)} />
              <Metric label="Paper stake" value={selectedEvaluation.stake === null ? "-" : `$${selectedEvaluation.stake.toFixed(0)}`} />
            </div>
          ) : null}

          {threshold ? <div className="threshold-box"><h3>What would change my mind?</h3><p>{threshold.explanation}</p><Metric label="Current ask" value={fmtProb(threshold.currentAskProbability)} /><Metric label="Minimum odds" value={threshold.thresholdDecimalOdds === null ? "-" : threshold.thresholdDecimalOdds.toFixed(2)} /></div> : null}

          <div className="duel-box">
            <h3>Strategy Duel</h3>
            <select value={duelRecipeId} onChange={(event) => setDuelRecipeId(event.target.value)}>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select>
            {duel ? <><p>{duel.summary}</p><div className="duel-results"><span>{duel.left.recipeLabel}: {duel.left.verdict}</span><span>{duel.right.recipeLabel}: {duel.right.verdict}</span></div></> : null}
          </div>

          <div className="provenance-box">
            <h3>Pin to paper route</h3>
            {paperQuote ? <><p>Exact mapped observation can become a normalized paper quote. No order is sent.</p><code>{paperQuote.provenance.venueId} | {paperQuote.provenance.externalMarketId} | {paperQuote.provenance.mappingId}</code></> : <p>Unavailable: only exact mapped observations can enter the existing paper quote/router path.</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="mini-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function keyFor(observation: { venueId: string; externalMarketId: string; externalOutcomeId: string }): string {
  return `${observation.venueId}:${observation.externalMarketId}:${observation.externalOutcomeId}`;
}

function fmtProb(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function fmtSignedProb(value: number | null): string {
  return value === null ? "-" : `${value >= 0 ? "+" : ""}${fmtProb(value)}`;
}

function fmtSize(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2);
}

function fmtAge(observedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(observedAt)) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

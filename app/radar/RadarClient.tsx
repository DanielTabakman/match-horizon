"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PythonStrategyResult,
  PythonStrategyRunMode,
  RadarSnapshot,
  StrategyRecipe,
  UserBeliefByMapping,
} from "../../src/lib/marketRadar/types";
import {
  BUILT_IN_RECIPES,
  DEFAULT_CUSTOM_RECIPE,
  calculateChangeMyMindThreshold,
  duelRecipes,
  evaluateRecipe,
  scoreObservation,
} from "../../src/lib/marketRadar/strategyEngine";
import { buildMappedObservationPaperQuote, effectiveObservationRouteState, evaluatePaperEligibility } from "../../src/lib/marketRadar/paperRoute";
import { buildRealExecutableQuotes, buildRealPaperRoute, type RealQuoteBuildResult } from "../../src/lib/marketRadar/realQuotes";
import type { GenericExecutionRoute } from "../../src/lib/execution/router";
import { PYTHON_STRATEGY_SAMPLES } from "../../src/lib/marketRadar/pythonSamples";
import {
  PYTHON_STRATEGY_LIMITS,
  buildPythonStrategyContext,
  enforcePythonAdvisoryRouteGate,
  validatePythonStrategyResult,
  validatePythonStrategyRunInput,
} from "../../src/lib/marketRadar/pythonStrategy";
import {
  marketScopeLabel,
  observationMatchesMarketScope,
  sortScopedObservations,
  type MarketScope,
} from "../../src/lib/marketRadar/marketRelevance";
import { RADAR_TXLINE_REFERENCE } from "../../src/lib/marketRadar/txlineReference";

type Props = { initialSnapshot: RadarSnapshot };
type LabTab = "built-in" | "python";
type SavedPythonScript = { id: string; name: string; source: string };
type PythonRunState =
  | { status: "idle"; result: null; stdout: string; stderr: string; error: string | null; elapsedMs: number | null; runtimeVersion: string | null }
  | { status: "running"; result: null; stdout: string; stderr: string; error: string | null; elapsedMs: number | null; runtimeVersion: string | null }
  | { status: "success"; result: PythonStrategyResult; stdout: string; stderr: string; error: null; elapsedMs: number; runtimeVersion: string | null }
  | { status: "error"; result: null; stdout: string; stderr: string; error: string; elapsedMs: number | null; runtimeVersion: string | null };

const routeLabels = { "context-only": "Context only", mapped: "Mapped", "paper-executable": "Paper executable" };
const recipeDescriptions: Record<string, string> = {
  "stale-market": "Compares an exact mapping against the captured TxLINE reference and freshness gates.",
  "consensus-outlier": "Looks for a venue price that differs from peer mapped observations.",
  "liquidity-sweep": "Checks whether your belief clears the ask with enough top-of-book depth.",
  "belief-confirmation": "Requires both your belief and peer consensus to point above the venue price.",
  "contrarian-tail": "Highlights low-probability outcomes with enough liquidity for paper analysis.",
  custom: "Uses your locally edited thresholds and sizing rules.",
};
const pythonSampleDescriptions: Record<string, string> = {
  "stale-market-detector": "Minimal TxLINE-reference check for one selected mapped observation.",
  "liquidity-adjusted-edge": "Adjusts user-belief edge for spread and top-of-book depth.",
  "consensus-outlier": "Compares the selected market to peer mapped observations.",
  "contrarian-tail": "Scores low-probability outcomes while respecting mapping limits.",
  "custom-interestingness-score": "Ranks observations with a simple informational score.",
  "minimal-hello-strategy": "Tiny smoke test that returns a context-only result.",
};
const PYTHON_SCRIPT_STORAGE_KEY = "match-horizon:python-strategy-scripts";
const DISPLAYED_OBSERVATION_LIMIT = 30;
const DEFAULT_PYTHON_RUN_STATE: PythonRunState = {
  status: "idle",
  result: null,
  stdout: "",
  stderr: "",
  error: null,
  elapsedMs: null,
  runtimeVersion: null,
};

export default function RadarClient({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [labTab, setLabTab] = useState<LabTab>("built-in");
  const [venue, setVenue] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [marketScope, setMarketScope] = useState<MarketScope>("world-cup-soccer");
  const [text, setText] = useState("");
  const [minimumLiquidity, setMinimumLiquidity] = useState("0");
  const [selectedRecipeId, setSelectedRecipeId] = useState("stale-market");
  const [duelRecipeId, setDuelRecipeId] = useState("liquidity-sweep");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [userBeliefs, setUserBeliefs] = useState<UserBeliefByMapping>({});
  const [customRecipe, setCustomRecipe] = useState<StrategyRecipe>(DEFAULT_CUSTOM_RECIPE);
  const [pythonSampleId, setPythonSampleId] = useState(PYTHON_STRATEGY_SAMPLES[0].id);
  const [pythonSource, setPythonSource] = useState(PYTHON_STRATEGY_SAMPLES[0].source);
  const [pythonRunMode, setPythonRunMode] = useState<PythonStrategyRunMode>("selected-observation");
  const [pythonTimeoutMs, setPythonTimeoutMs] = useState(PYTHON_STRATEGY_LIMITS.defaultTimeoutMs);
  const [savedPythonScripts, setSavedPythonScripts] = useState<SavedPythonScript[]>([]);
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false);
  const [pythonRun, setPythonRun] = useState<PythonRunState>(DEFAULT_PYTHON_RUN_STATE);
  const [realUserProbability, setRealUserProbability] = useState("55");
  const [realTargetStake, setRealTargetStake] = useState("5000");
  const [realMinimumOdds, setRealMinimumOdds] = useState("2.20");
  const [realRoute, setRealRoute] = useState<GenericExecutionRoute | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      try {
        const savedRecipe = window.localStorage.getItem("match-horizon:radar-custom-recipe");
        if (savedRecipe) {
          setCustomRecipe({ ...DEFAULT_CUSTOM_RECIPE, ...JSON.parse(savedRecipe) });
        }
      } catch {
        window.localStorage.removeItem("match-horizon:radar-custom-recipe");
      }
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PYTHON_SCRIPT_STORAGE_KEY) ?? "[]") as unknown;
        setSavedPythonScripts(Array.isArray(parsed) ? parsed.filter((item): item is SavedPythonScript => isSavedPythonScript(item)) : []);
      } catch {
        window.localStorage.removeItem(PYTHON_SCRIPT_STORAGE_KEY);
      }
      setLocalStorageLoaded(true);
    }, 0);
    return () => window.clearTimeout(loadSavedState);
  }, []);
  useEffect(() => {
    if (localStorageLoaded) {
      window.localStorage.setItem("match-horizon:radar-custom-recipe", JSON.stringify(customRecipe));
    }
  }, [customRecipe, localStorageLoaded]);
  useEffect(() => {
    if (localStorageLoaded) {
      window.localStorage.setItem(PYTHON_SCRIPT_STORAGE_KEY, JSON.stringify(savedPythonScripts));
    }
  }, [savedPythonScripts, localStorageLoaded]);
  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const recipes = useMemo(() => [...BUILT_IN_RECIPES, customRecipe], [customRecipe]);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0];
  const duelRecipe = recipes.find((recipe) => recipe.id === duelRecipeId) ?? recipes[1];
  const evaluationNow = Date.parse(snapshot.observedAt);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          snapshot.observations
            .filter((item) => observationMatchesMarketScope(item, marketScope))
            .map((item) => item.category ?? item.sport ?? "Uncategorized"),
        ),
      ).sort(),
    [marketScope, snapshot.observations],
  );
  const ranked = useMemo(
    () =>
      snapshot.observations
        .map((observation) => {
          const evaluation = evaluateRecipe({
            recipe: selectedRecipe,
            observation,
            observations: snapshot.observations,
            userBeliefs,
            txlineReference: RADAR_TXLINE_REFERENCE,
            now: evaluationNow,
          });
          const eligibility = evaluatePaperEligibility({ observation, evaluation, recipe: selectedRecipe, now: evaluationNow });
          return {
            observation,
            score: scoreObservation({ observation, observations: snapshot.observations, userBeliefs, now: evaluationNow }),
            evaluation,
            eligibility,
            effectiveRouteState: effectiveObservationRouteState({ observation, eligibility }),
          };
        })
        .sort((left, right) => right.score.total - left.score.total),
    [evaluationNow, selectedRecipe, snapshot.observations, userBeliefs],
  );
  const scoped = useMemo(
    () => sortScopedObservations(ranked.filter(({ observation }) => observationMatchesMarketScope(observation, marketScope)), marketScope),
    [marketScope, ranked],
  );
  const filtered = scoped.filter(({ effectiveRouteState, observation }) => {
    const haystack = `${observation.title} ${observation.outcomeLabel} ${observation.venueLabel}`.toLowerCase();
    const askDepth = observation.availableAskSize ?? 0;
    const categoryLabel = observation.category ?? observation.sport ?? "Uncategorized";
    return (
      (venue === "all" || observation.venueId === venue) &&
      (status === "all" || effectiveRouteState === status) &&
      (category === "all" || categoryLabel === category) &&
      (!text || haystack.includes(text.toLowerCase())) &&
      askDepth >= Number(minimumLiquidity || 0)
    );
  });
  const displayed = filtered.slice(0, DISPLAYED_OBSERVATION_LIMIT);
  const hasActiveFilters =
    venue !== "all" || status !== "all" || category !== "all" || text.trim() !== "" || Number(minimumLiquidity || 0) > 0;
  const selected = filtered.find(({ observation }) => keyFor(observation) === selectedKey) ?? filtered[0] ?? null;
  const selectedEvaluation = selected?.evaluation ?? null;
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
        txlineReference: RADAR_TXLINE_REFERENCE,
        now: evaluationNow,
      })
    : null;
  const paperEligibility = selected?.eligibility ?? null;
  const paperQuote = selected && paperEligibility
    ? buildMappedObservationPaperQuote({ observation: selected.observation, eligibility: paperEligibility })
    : null;
  const pythonContext = buildPythonStrategyContext({
    selectedObservation: selected?.observation ?? null,
    observations: filtered.map(({ observation }) => observation),
    userBeliefs,
    txlineReference: RADAR_TXLINE_REFERENCE,
    selectedStrategyParameters: selectedRecipe,
    runMode: pythonRunMode,
    now: snapshot.observedAt,
  });
  const realQuoteSourceStatuses = useMemo(
    () =>
      Object.fromEntries(
        snapshot.health.map((health) => [health.venueId, health.status === "live" ? "live" : "captured"] as const),
      ),
    [snapshot.health],
  );
  const realQuoteResult = useMemo(
    () =>
      buildRealExecutableQuotes({
        observations: snapshot.observations,
        now: evaluationNow,
        sourceStatuses: realQuoteSourceStatuses,
      }),
    [evaluationNow, realQuoteSourceStatuses, snapshot.observations],
  );
  const realUserProbabilityValue = Number(realUserProbability) / 100;
  const realTargetStakeValue = Number(realTargetStake);
  const realMinimumOddsValue = Number(realMinimumOdds);
  const canBuildRealRoute =
    realQuoteResult.status === "ready" &&
    Number.isFinite(realUserProbabilityValue) &&
    realUserProbabilityValue > 0 &&
    realUserProbabilityValue <= 1 &&
    Number.isFinite(realTargetStakeValue) &&
    realTargetStakeValue > 0 &&
    Number.isFinite(realMinimumOddsValue) &&
    realMinimumOddsValue > 1;

  async function refresh() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Radar refresh failed with HTTP ${response.status}.`);
      }
      const nextSnapshot = (await response.json()) as unknown;
      if (!isRadarSnapshot(nextSnapshot)) {
        throw new Error("Radar refresh returned an invalid response.");
      }
      setSnapshot(nextSnapshot);
      setRefreshError(null);
    } catch {
      setRefreshError("Refresh failed. Showing the previous snapshot.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function clearFilters() {
    setVenue("all");
    setStatus("all");
    setCategory("all");
    setText("");
    setMinimumLiquidity("0");
  }

  function showMarketScope(scope: MarketScope) {
    clearFilters();
    setMarketScope(scope);
  }

  function changeMarketScope(scope: MarketScope) {
    setMarketScope(scope);
    setCategory("all");
  }

  function updateBelief(value: string) {
    if (!selected?.observation.mapping) return;
    const parsed = Number(value);
    setUserBeliefs((current) => ({
      ...current,
      [selected.observation.mapping!.id]: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) / 100 : 0,
    }));
  }

  function buildRealRoute() {
    if (realQuoteResult.status !== "ready" || !canBuildRealRoute) {
      return;
    }

    setRealRoute(
      buildRealPaperRoute(
        {
          selectionId: realQuoteResult.canonicalSelectionId,
          requestedStake: realTargetStakeValue,
          minimumDecimalOdds: realMinimumOddsValue,
          userProbability: realUserProbabilityValue,
        },
        realQuoteResult.quotes,
      ),
    );
  }

  function loadPythonSample(sampleId: string) {
    const sample = PYTHON_STRATEGY_SAMPLES.find((item) => item.id === sampleId) ?? PYTHON_STRATEGY_SAMPLES[0];
    setPythonSampleId(sample.id);
    setPythonSource(sample.source);
    setPythonRun(DEFAULT_PYTHON_RUN_STATE);
  }

  function savePythonScript() {
    const fallbackName = PYTHON_STRATEGY_SAMPLES.find((item) => item.id === pythonSampleId)?.label ?? "Custom Strategy";
    const name = promptForText("Script name", fallbackName, fallbackName);
    if (!name) return;
    setSavedPythonScripts((current) => [
      { id: `${Date.now()}`, name, source: pythonSource },
      ...current.filter((item) => item.name !== name),
    ]);
  }

  function loadSavedPythonScript(id: string) {
    const script = savedPythonScripts.find((item) => item.id === id);
    if (!script) return;
    setPythonSampleId("");
    setPythonSource(script.source);
    setPythonRun(DEFAULT_PYTHON_RUN_STATE);
  }

  function renameSavedPythonScript(id: string) {
    const script = savedPythonScripts.find((item) => item.id === id);
    if (!script) return;
    const name = promptForText("New script name", script.name, null);
    if (!name) return;
    setSavedPythonScripts((current) => current.map((item) => (item.id === id ? { ...item, name } : item)));
  }

  function deleteSavedPythonScript(id: string) {
    setSavedPythonScripts((current) => current.filter((item) => item.id !== id));
  }

  function resetPythonLab() {
    stopPythonRun("Python worker reset.");
    loadPythonSample(PYTHON_STRATEGY_SAMPLES[0].id);
  }

  function stopPythonRun(message = "Python run stopped.") {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    setPythonRun((current) =>
      current.status === "running"
        ? { status: "error", result: null, stdout: current.stdout, stderr: current.stderr, error: message, elapsedMs: null, runtimeVersion: null }
        : current,
    );
  }

  function runPythonStrategy() {
    stopPythonRun();
    try {
      validatePythonStrategyRunInput({ source: pythonSource, context: pythonContext });
    } catch (error) {
      setPythonRun({
        status: "error",
        result: null,
        stdout: "",
        stderr: "",
        error: formatError(error),
        elapsedMs: null,
        runtimeVersion: null,
      });
      return;
    }

    const worker = new Worker("/python-strategy-worker.js", { type: "module" });
    workerRef.current = worker;
    setPythonRun({ status: "running", result: null, stdout: "", stderr: "", error: null, elapsedMs: null, runtimeVersion: null });
    timeoutRef.current = window.setTimeout(() => {
      stopPythonRun("Python runtime failed to load within 15000ms.");
    }, 15_000);

    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "started") {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          stopPythonRun(`Python run terminated after ${pythonTimeoutMs}ms.`);
        }, pythonTimeoutMs);
        setPythonRun((current) => ({
          ...current,
          runtimeVersion: typeof event.data.runtimeVersion === "string" ? event.data.runtimeVersion : null,
        }));
        return;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      worker.terminate();
      workerRef.current = null;

      if (event.data?.type === "success") {
        try {
          const result = enforcePythonAdvisoryRouteGate({
            result: validatePythonStrategyResult(event.data.result),
            selectedObservation: selected?.observation ?? null,
          });
          setPythonRun({
            status: "success",
            result,
            stdout: String(event.data.stdout ?? ""),
            stderr: String(event.data.stderr ?? ""),
            error: null,
            elapsedMs: Number(event.data.elapsedMs ?? 0),
            runtimeVersion: typeof event.data.runtimeVersion === "string" ? event.data.runtimeVersion : null,
          });
        } catch (error) {
          setPythonRun({
            status: "error",
            result: null,
            stdout: String(event.data.stdout ?? ""),
            stderr: String(event.data.stderr ?? ""),
            error: formatError(error),
            elapsedMs: Number(event.data.elapsedMs ?? 0),
            runtimeVersion: typeof event.data.runtimeVersion === "string" ? event.data.runtimeVersion : null,
          });
        }
      } else {
        setPythonRun({
          status: "error",
          result: null,
          stdout: String(event.data?.stdout ?? ""),
          stderr: String(event.data?.stderr ?? ""),
          error: String(event.data?.error ?? "Python worker failed."),
          elapsedMs: typeof event.data?.elapsedMs === "number" ? event.data.elapsedMs : null,
          runtimeVersion: typeof event.data?.runtimeVersion === "string" ? event.data.runtimeVersion : null,
        });
      }
    };
    worker.onerror = (error) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      worker.terminate();
      workerRef.current = null;
      setPythonRun({
        status: "error",
        result: null,
        stdout: "",
        stderr: "",
        error: error.message || "Python worker failed to load. Fixture-backed Radar data still works without Pyodide.",
        elapsedMs: null,
        runtimeVersion: null,
      });
    };
    worker.postMessage({ type: "run", source: pythonSource, context: pythonContext });
  }

  return (
    <main className="shell radar-shell">
      <section className="radar-topbar">
        <div>
          <p className="eyebrow">Market Radar</p>
          <h1>Read-only market radar</h1>
          <p className="muted">
            Live SX Bet and Polymarket observations are separate from the captured TxLINE fixture unless an explicit
            mapping connects them.
          </p>
        </div>
        <div className="radar-actions">
          <button type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="radar-summary-strip" aria-label="Radar summary">
        <Metric label="Imported observations" value={snapshot.observations.length.toString()} />
        <Metric label="Relevant scope" value={`${scoped.length} of ${snapshot.observations.length}`} />
        <Metric label="Matching observations" value={`${filtered.length} ${marketScopeLabel(marketScope)}`} />
        <Metric label="Displayed" value={`${displayed.length} of ${filtered.length}`} />
        <Metric label="Source status" value={summarizeHealth(snapshot.health)} />
        <Metric label="Snapshot time" value={formatTimestamp(snapshot.observedAt)} />
      </section>
      {refreshError ? (
        <p className="refresh-status" role="status">
          {refreshError}
        </p>
      ) : null}

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
        <label>
          <span>Market scope</span>
          <select value={marketScope} onChange={(event) => changeMarketScope(event.target.value as MarketScope)} aria-label="Market scope filter">
            <option value="world-cup-soccer">World Cup & soccer</option>
            <option value="all-sports">All sports</option>
            <option value="all-imported">All imported</option>
          </select>
        </label>
        <label>
          <span>Venue</span>
          <select value={venue} onChange={(event) => setVenue(event.target.value)} aria-label="Venue filter">
            <option value="all">All venues</option>
            <option value="sx-bet">SX Bet</option>
            <option value="polymarket">Polymarket</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
            <option value="all">All sports/categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Route state</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Mapping state filter">
            <option value="all">All mapping states</option>
            <option value="context-only">Context only</option>
            <option value="mapped">Mapped</option>
            <option value="paper-executable">Paper executable</option>
          </select>
        </label>
        <label className="filter-search">
          <span>Search</span>
          <input aria-label="Search observations" placeholder="Title, outcome, venue" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <label>
          <span>Min ask depth</span>
          <input aria-label="Minimum liquidity" inputMode="decimal" min="0" type="number" value={minimumLiquidity} onChange={(event) => setMinimumLiquidity(event.target.value)} />
          <small>Filters by available ask size.</small>
        </label>
        <button type="button" className="button-ghost" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear filters
        </button>
      </section>

      <section className="radar-layout">
        <div className="radar-cards" aria-label="Ranked market observations">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h2>No markets match these filters</h2>
              <p>Broaden the market scope or clear the ordinary filters to recover imported Radar observations.</p>
              <div className="empty-actions">
                <button type="button" className="button-primary" onClick={() => showMarketScope("all-sports")}>Show all sports</button>
                <button type="button" className="button-secondary" onClick={() => showMarketScope("all-imported")}>Show all imported</button>
                <button type="button" className="button-ghost" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
              </div>
            </div>
          ) : null}
          {displayed.map(({ effectiveRouteState, observation, score, evaluation }) => (
            <button
              type="button"
              className={`radar-card ${selected && keyFor(selected.observation) === keyFor(observation) ? "selected" : ""}`}
              key={keyFor(observation)}
              onClick={() => setSelectedKey(keyFor(observation))}
            >
              <div className="card-line"><span>{observation.venueLabel}</span><strong>{score.total.toFixed(1)}</strong></div>
              <h2>{observation.title}</h2>
              <p>{observation.outcomeLabel}</p>
              <div className="tag-row"><span>{routeLabels[effectiveRouteState]}</span><span>{evaluation.verdict.replace("-", " ")}</span></div>
              <div className="metrics-row">
                <Metric label="Best ask" value={fmtProb(observation.bestAskProbability ?? observation.midpointProbability)} />
                <Metric label="Spread" value={fmtProb(observation.spreadProbability)} />
                <Metric label="Ask depth" value={fmtSize(observation.availableAskSize ?? 0)} />
                <Metric label="Age" value={fmtAge(observation.observedAt, snapshot.observedAt)} />
              </div>
            </button>
          ))}
        </div>

        <aside className="strategy-panel" aria-label="Strategy Lab">
          <div className="panel-heading"><div><h2>Strategy Lab</h2><span>{selected ? selected.observation.outcomeLabel : "No observation selected"}</span></div></div>
          {selected ? (
            <SelectedMarketSummary selected={selected} observedAt={snapshot.observedAt} />
          ) : (
            <div className="empty-state compact"><p>Select a market after clearing or changing filters.</p></div>
          )}
          <RealVenueQuotesPanel
            result={realQuoteResult}
            route={realRoute}
            userProbability={realUserProbability}
            targetStake={realTargetStake}
            minimumOdds={realMinimumOdds}
            canBuild={canBuildRealRoute}
            onUserProbabilityChange={(value) => {
              setRealUserProbability(value);
              setRealRoute(null);
            }}
            onTargetStakeChange={(value) => {
              setRealTargetStake(value);
              setRealRoute(null);
            }}
            onMinimumOddsChange={(value) => {
              setRealMinimumOdds(value);
              setRealRoute(null);
            }}
            onBuild={buildRealRoute}
          />
          <div className="lab-tabs" role="tablist" aria-label="Strategy Lab mode">
            <button type="button" className={labTab === "built-in" ? "active" : ""} onClick={() => setLabTab("built-in")}>Built-in</button>
            <button type="button" className={labTab === "python" ? "active" : ""} onClick={() => setLabTab("python")}>Python Strategy</button>
          </div>
          {labTab === "built-in" ? (
            <>
              <label><span>Recipe</span><select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select></label>
              <p className="radar-note">{describeRecipe(selectedRecipe)}</p>
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
                  <div className="evaluation-summary">
                    <strong>{selectedEvaluation.verdict.replace("-", " ")}</strong>
                    <div className="metrics-row compact">
                      <Metric label="Reference" value={fmtProb(selectedEvaluation.referenceProbability)} />
                      <Metric label="Edge" value={fmtSignedProb(selectedEvaluation.edge)} />
                      <Metric label="Paper stake" value={selectedEvaluation.stake === null ? "-" : `$${selectedEvaluation.stake.toFixed(0)}`} />
                    </div>
                  </div>
                  <ReasonGroup title="Passed" reasons={selectedEvaluation.acceptedReasons} emptyText="No passing gates yet." />
                  <ReasonGroup title="Blocked by" reasons={selectedEvaluation.rejectedReasons} emptyText="No blocking gates." />
                  <ReasonGroup title="Context limitations" reasons={selectedEvaluation.contextOnlyReasons} emptyText="No context limitations." />
                </div>
              ) : null}

              {selected ? (
                <details className="score-detail">
                  <summary>Why surfaced</summary>
                  <div className="score-bars">
                    {Object.entries(selected.score.breakdown).map(([label, value]) => <span key={label}>{formatBreakdownLabel(label)}: {value.toFixed(2)}</span>)}
                  </div>
                </details>
              ) : null}

              {threshold ? <div className="threshold-box"><h3>What would change my mind?</h3><p>{threshold.explanation}</p><Metric label="Current ask" value={fmtProb(threshold.currentAskProbability)} /><Metric label="Minimum odds" value={threshold.thresholdDecimalOdds === null ? "-" : threshold.thresholdDecimalOdds.toFixed(2)} /></div> : null}

              <BuiltInDuel duelRecipeId={duelRecipeId} recipes={recipes} setDuelRecipeId={setDuelRecipeId} duel={duel} />
            </>
          ) : (
            <section className="python-lab" aria-label="Python Strategy Lab">
              <p className="python-badge">Trusted local script — paper analysis only</p>
              <p className="radar-note">Runs locally in a disposable Pyodide Web Worker and returns advisory paper analysis only.</p>
              <label htmlFor="python-sample"><span>Editable sample</span></label>
              <select id="python-sample" value={pythonSampleId} onChange={(event) => loadPythonSample(event.target.value)}>{PYTHON_STRATEGY_SAMPLES.map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select>
              <p className="radar-note">{pythonSampleDescriptions[pythonSampleId] ?? "Custom local script."}</p>
              <label htmlFor="python-source"><span>Python strategy code</span></label>
              <textarea id="python-source" value={pythonSource} onChange={(event) => setPythonSource(event.target.value)} spellCheck={false} />
              <div className="python-actions">
                <button className="button-primary" type="button" onClick={runPythonStrategy} disabled={pythonRun.status === "running"}>{pythonRun.status === "running" ? "Running..." : "Run strategy"}</button>
              </div>
              <div className={`evaluation ${pythonRun.result?.decision === "accept" ? "accepted" : pythonRun.result?.decision === "reject" ? "rejected" : pythonRun.status === "error" ? "rejected" : "context-only"}`}>
                <strong>{pythonRun.status}</strong>
                {pythonRun.result ? (
                  <>
                    <p>{pythonRun.result.decision}</p>
                    {pythonRun.result.reasons.map((reason) => <p key={reason}>{reason}</p>)}
                    <Metric label="Score" value={pythonRun.result.score === null ? "-" : pythonRun.result.score.toFixed(2)} />
                    <Metric label="Min odds" value={pythonRun.result.proposedMinimumOdds === undefined || pythonRun.result.proposedMinimumOdds === null ? "-" : pythonRun.result.proposedMinimumOdds.toFixed(2)} />
                    <Metric label="Stake" value={pythonRun.result.proposedStake === undefined || pythonRun.result.proposedStake === null ? "-" : `$${pythonRun.result.proposedStake.toFixed(0)}`} />
                  </>
                ) : null}
                {pythonRun.error ? <p>{pythonRun.error}</p> : null}
                <Metric label="Timing" value={pythonRun.elapsedMs === null ? "-" : `${pythonRun.elapsedMs}ms`} />
                <Metric label="Runtime" value={pythonRun.runtimeVersion ?? "not loaded"} />
              </div>
              <details className="advanced-panel">
                <summary>Advanced run settings</summary>
                <div className="python-run-grid">
                  <label htmlFor="python-run-mode"><span>Run against</span></label>
                  <select id="python-run-mode" value={pythonRunMode} onChange={(event) => setPythonRunMode(event.target.value as PythonStrategyRunMode)}><option value="selected-observation">Selected observation</option><option value="filtered-batch">Current filtered batch</option></select>
                  <label htmlFor="python-timeout"><span>Timeout ms</span></label>
                  <input id="python-timeout" type="number" min={500} max={PYTHON_STRATEGY_LIMITS.maximumTimeoutMs} step={500} value={pythonTimeoutMs} onChange={(event) => setPythonTimeoutMs(Math.min(PYTHON_STRATEGY_LIMITS.maximumTimeoutMs, Math.max(500, Number(event.target.value))))} />
                </div>
                <div className="python-actions">
                  <button type="button" onClick={() => stopPythonRun()} disabled={pythonRun.status !== "running"}>Stop</button>
                  <button type="button" onClick={() => navigator.clipboard.writeText(pythonSource)}>Copy sample</button>
                  <button type="button" onClick={resetPythonLab}>Reset</button>
                </div>
              </details>
              <section className="saved-scripts-section">
                <div className="panel-heading compact-heading">
                  <h3>Saved locally</h3>
                  <button type="button" className="button-secondary" onClick={savePythonScript}>Save locally</button>
                </div>
                {savedPythonScripts.length > 0 ? (
                  <div className="saved-scripts">
                    {savedPythonScripts.map((script) => (
                      <div key={script.id}>
                        <button type="button" onClick={() => loadSavedPythonScript(script.id)}>{script.name}</button>
                        <button type="button" onClick={() => renameSavedPythonScript(script.id)}>Rename</button>
                        <button type="button" onClick={() => deleteSavedPythonScript(script.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="radar-note">No saved local scripts yet.</p>}
              </section>
              {pythonRun.result && selectedEvaluation ? (
                <div className="duel-box">
                  <h3>Strategy Duel</h3>
                  <p>{selectedRecipe.label}: {selectedEvaluation.verdict} | Python: {pythonRun.result.decision}</p>
                </div>
              ) : null}
              <details className="python-logs"><summary>Logs</summary><pre>{pythonRun.stdout || "stdout empty"}</pre><pre>{pythonRun.stderr || "stderr empty"}</pre></details>
              <details className="input-preview"><summary>Input preview</summary><pre>{JSON.stringify(pythonContext, null, 2)}</pre></details>
            </section>
          )}

          <div className="provenance-box">
            <h3>Paper-route eligibility</h3>
            {paperQuote ? <><p>Selected TypeScript gates passed; this mapped observation can become a normalized paper quote. No order is sent.</p><code>{paperQuote.provenance.venueId} | {paperQuote.provenance.externalMarketId} | {paperQuote.provenance.mappingId}</code></> : <p>Unavailable: {paperEligibility?.reasons.join("; ") ?? "select an observation first"}.</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="mini-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function RealVenueQuotesPanel({
  result,
  route,
  userProbability,
  targetStake,
  minimumOdds,
  canBuild,
  onUserProbabilityChange,
  onTargetStakeChange,
  onMinimumOddsChange,
  onBuild,
}: {
  result: RealQuoteBuildResult;
  route: GenericExecutionRoute | null;
  userProbability: string;
  targetStake: string;
  minimumOdds: string;
  canBuild: boolean;
  onUserProbabilityChange: (value: string) => void;
  onTargetStakeChange: (value: string) => void;
  onMinimumOddsChange: (value: string) => void;
  onBuild: () => void;
}) {
  const quotes = result.quotes;
  const stateLabel =
    result.status === "ready"
      ? quotes.length >= 2
        ? "Two or more exact venues available"
        : "One exact venue available"
      : result.status === "quotes-stale"
        ? "Quotes stale"
        : "No exact cross-venue overlap";

  return (
    <section className="real-quotes-panel" aria-label="Real venue quotes">
      <div className="panel-heading compact-heading">
        <div>
          <h3>Real venue quotes</h3>
          <span>Real read-only quotes · paper execution only</span>
        </div>
        <strong>{stateLabel}</strong>
      </div>
      {quotes.length > 0 ? (
        <div className="real-quote-list">
          {quotes.map((quote) => (
            <div className="real-quote-row" key={quote.quoteId}>
              <strong>{quote.venueLabel}</strong>
              <span>{quote.provenance.canonicalSelectionId}</span>
              <Metric label="Ask" value={fmtProb(1 / quote.decimalOdds)} />
              <Metric label="Odds" value={quote.decimalOdds.toFixed(3)} />
              <Metric label="Ask notional" value={`$${quote.availableStake.toFixed(0)}`} />
              <Metric label="Age" value={fmtAge(quote.provenance.observedAt, new Date().toISOString())} />
              <span className="quote-badge">{quote.provenance.status}</span>
              <code>{quote.provenance.mappingId}</code>
            </div>
          ))}
        </div>
      ) : (
        <p className="radar-note">No exact real quotes are available for routing.</p>
      )}
      {result.status === "no-exact-overlap" || result.status === "quotes-stale" ? <p className="radar-note">{result.reason}</p> : null}
      <div className="real-route-controls">
        <label><span>Your probability</span><input aria-label="Real route user probability" inputMode="decimal" min="0" max="100" type="number" value={userProbability} onChange={(event) => onUserProbabilityChange(event.target.value)} /></label>
        <label><span>Paper target stake</span><input aria-label="Real route paper target stake" inputMode="decimal" min="1" type="number" value={targetStake} onChange={(event) => onTargetStakeChange(event.target.value)} /></label>
        <label><span>Minimum decimal odds</span><input aria-label="Real route minimum decimal odds" inputMode="decimal" min="1.01" step="0.01" type="number" value={minimumOdds} onChange={(event) => onMinimumOddsChange(event.target.value)} /></label>
        <button className="button-primary" type="button" disabled={!canBuild} onClick={onBuild}>Build paper route</button>
      </div>
      {route ? (
        <div className="real-route-result">
          <div className="metrics-row compact">
            <Metric label="Requested" value={`$${route.requestedStake.toFixed(0)}`} />
            <Metric label="Filled" value={`$${route.filledStake.toFixed(0)}`} />
            <Metric label="Unfilled" value={`$${route.unfilledStake.toFixed(0)}`} />
            <Metric label="Weighted odds" value={route.weightedAverageOdds === null ? "-" : route.weightedAverageOdds.toFixed(3)} />
            <Metric label="Gross payout" value={`$${route.estimatedGrossPayout.toFixed(0)}`} />
            <Metric label="Expected value" value={`$${route.expectedValue.toFixed(0)}`} />
          </div>
          {route.unfilledStake > 0 ? <p className="radar-note">Visible capacity insufficient for the full requested stake.</p> : null}
          <div className="real-fill-list">
            {route.fills.map((fill) => (
              <p key={fill.quoteId}>{fill.venueLabel}: ${fill.filledStake.toFixed(0)} at {fill.decimalOdds.toFixed(3)}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SelectedMarketSummary({
  selected,
  observedAt,
}: {
  selected: {
    observation: {
      venueLabel: string;
      title: string;
      outcomeLabel: string;
      bestAskProbability: number | null;
      midpointProbability: number | null;
      spreadProbability: number | null;
      availableAskSize: number | null;
      availableBidSize: number | null;
      observedAt: string;
      mapping: { id: string; equivalence: string; resolutionNotes: string } | null;
    };
    score: { total: number };
    effectiveRouteState: keyof typeof routeLabels;
  };
  observedAt: string;
}) {
  const observation = selected.observation;
  const askDepth = observation.availableAskSize ?? 0;

  return (
    <section className="selected-market-summary" aria-label="Selected market summary">
      <div>
        <span className="eyebrow">{observation.venueLabel}</span>
        <h3>{observation.title}</h3>
        <p>{observation.outcomeLabel}</p>
      </div>
      <div className="metrics-row compact">
        <Metric label="State" value={routeLabels[selected.effectiveRouteState]} />
        <Metric label="Best ask" value={fmtProb(observation.bestAskProbability ?? observation.midpointProbability)} />
        <Metric label="Spread" value={fmtProb(observation.spreadProbability)} />
        <Metric label="Ask depth" value={fmtSize(askDepth)} />
        <Metric label="Age" value={fmtAge(observation.observedAt, observedAt)} />
        <Metric label="Score" value={selected.score.total.toFixed(1)} />
      </div>
      <p className="radar-note">
        {observation.mapping
          ? `Mapping ${observation.mapping.id} is ${observation.mapping.equivalence}. ${observation.mapping.resolutionNotes}`
          : "No mapping has been reviewed for this observation, so it can only provide context."}
      </p>
    </section>
  );
}

function ReasonGroup({ title, reasons, emptyText }: { title: string; reasons: string[]; emptyText: string }) {
  return (
    <section className="reason-group">
      <h3>{title}</h3>
      {reasons.length > 0 ? (
        <ul>
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function BuiltInDuel({
  duelRecipeId,
  recipes,
  setDuelRecipeId,
  duel,
}: {
  duelRecipeId: string;
  recipes: StrategyRecipe[];
  setDuelRecipeId: (value: string) => void;
  duel: ReturnType<typeof duelRecipes> | null;
}) {
  return (
    <div className="duel-box">
      <h3>Strategy Duel</h3>
      <select value={duelRecipeId} onChange={(event) => setDuelRecipeId(event.target.value)}>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select>
      {duel ? <><p>{duel.summary}</p><div className="duel-results"><span>{duel.left.recipeLabel}: {duel.left.verdict}</span><span>{duel.right.recipeLabel}: {duel.right.verdict}</span></div></> : null}
    </div>
  );
}

function describeRecipe(recipe: StrategyRecipe): string {
  return recipeDescriptions[recipe.id] ?? "Uses the selected recipe thresholds against the selected observation.";
}

function summarizeHealth(health: RadarSnapshot["health"]): string {
  const counts = health.reduce(
    (current, item) => ({
      ...current,
      [item.status]: current[item.status] + 1,
    }),
    { fallback: 0, live: 0, unavailable: 0 },
  );
  const parts = [
    counts.live > 0 ? `${counts.live} live` : null,
    counts.fallback > 0 ? `${counts.fallback} fallback` : null,
    counts.unavailable > 0 ? `${counts.unavailable} unavailable` : null,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? "unavailable" : parts.join(" · ");
}

function isRadarSnapshot(value: unknown): value is RadarSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<RadarSnapshot>;
  return (
    typeof candidate.observedAt === "string" &&
    Array.isArray(candidate.observations) &&
    Array.isArray(candidate.health)
  );
}

function isSavedPythonScript(value: unknown): value is SavedPythonScript {
  return typeof value === "object" && value !== null && "id" in value && "name" in value && "source" in value;
}

function promptForText(message: string, defaultValue: string, unsupportedFallback: string | null): string | null {
  try {
    return window.prompt(message, defaultValue);
  } catch {
    return unsupportedFallback;
  }
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

function fmtAge(observedAt: string, baseAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(baseAt) - Date.parse(observedAt)) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatBreakdownLabel(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import type { BeliefByOutcome, BeliefComparison, OutcomeDisagreement } from "../beliefComparison";
import { compareBeliefsToMarket } from "../beliefComparison";
import type { MarketSnapshot, OutcomeQuote, ResultReceipt, ScoreEvent } from "../domain";
import type { ExecutionPlan } from "../execution/pricing";
import type { ExecutionRoute } from "../execution/router";
import type { MatchReplay, ReplayEvent } from "./types";

export type EvaluationSnapshot = {
  belief: BeliefByOutcome;
  market: MarketSnapshot;
  comparison: BeliefComparison;
  strongestPositive: OutcomeDisagreement;
  executionPlan: ExecutionPlan | null;
  selectedExpression: OutcomeQuote["outcomeId"];
  executionRoute: ExecutionRoute | null;
  capturedAt: string;
};

export type ReplayTimelineItem = {
  key: string;
  occurredAt: string;
  label: string;
  score: ReplayScore;
};

export type ReplayScore = {
  score1: number | null;
  score2: number | null;
};

export type ReplayProjection = {
  cursor: number;
  score: ReplayScore;
  recentEvents: ReplayTimelineItem[];
  finalizedReceipt: ResultReceipt | null;
};

export type SettledExpression = {
  outcomeId: OutcomeQuote["outcomeId"];
  label: string;
  occurred: boolean;
};

const RECENT_EVENT_LIMIT = 6;

export function freezeEvaluationSnapshot(
  market: MarketSnapshot,
  belief: BeliefByOutcome,
  capturedAt: string,
  executionPlan: ExecutionPlan | null = null,
): EvaluationSnapshot | null {
  const comparison = compareBeliefsToMarket(market, belief);
  if (!comparison.isValid || !comparison.strongestPositive) {
    return null;
  }

  return {
    belief: { ...belief },
    market,
    comparison,
    strongestPositive: comparison.strongestPositive,
    selectedExpression: comparison.strongestPositive.outcomeId,
    executionPlan,
    executionRoute: executionPlan?.route ?? null,
    capturedAt,
  };
}

export function projectReplay(replay: MatchReplay, cursor: number): ReplayProjection {
  const boundedCursor = Math.max(0, Math.min(cursor, replay.events.length));
  const visibleEvents = replay.events.slice(0, boundedCursor);
  const score = visibleEvents.reduce<ReplayScore>(
    (currentScore, event) => {
      if (event.type !== "score_event") {
        return currentScore;
      }

      if (event.payload.score1 === null || event.payload.score2 === null) {
        return currentScore;
      }

      return {
        score1: event.payload.score1,
        score2: event.payload.score2,
      };
    },
    { score1: null, score2: null },
  );

  const finalizedReceipt =
    [...visibleEvents].reverse().find((event) => event.type === "finalization")?.payload ?? null;

  return {
    cursor: boundedCursor,
    score,
    recentEvents: visibleEvents.slice(-RECENT_EVENT_LIMIT).map(toTimelineItem),
    finalizedReceipt,
  };
}

export function settleExpression(
  outcomeId: OutcomeQuote["outcomeId"],
  receipt: ResultReceipt,
  market: MarketSnapshot,
): SettledExpression {
  const occurred =
    (outcomeId === "participant_1" && receipt.finalScore1 > receipt.finalScore2) ||
    (outcomeId === "draw" && receipt.finalScore1 === receipt.finalScore2) ||
    (outcomeId === "participant_2" && receipt.finalScore2 > receipt.finalScore1);

  return {
    outcomeId,
    label: labelForOutcome(market, outcomeId),
    occurred,
  };
}

export function hasObservedScore(event: ReplayEvent): boolean {
  return event.type === "score_event" && event.payload.score1 !== null && event.payload.score2 !== null;
}

function toTimelineItem(event: ReplayEvent): ReplayTimelineItem {
  if (event.type === "finalization") {
    return {
      key: `finalization-${event.payload.sequence ?? "unknown"}`,
      occurredAt: event.occurredAt,
      label: "Result finalized",
      score: {
        score1: event.payload.finalScore1,
        score2: event.payload.finalScore2,
      },
    };
  }

  return {
    key: `score-${event.payload.sequence ?? event.occurredAt}`,
    occurredAt: event.occurredAt,
    label: summarizeScoreEvent(event.payload),
    score: {
      score1: event.payload.score1,
      score2: event.payload.score2,
    },
  };
}

function summarizeScoreEvent(event: ScoreEvent): string {
  return event.eventType
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForOutcome(market: MarketSnapshot, outcomeId: OutcomeQuote["outcomeId"]): string {
  const quote = market.outcomes.find((outcome) => outcome.outcomeId === outcomeId);
  if (!quote) {
    throw new Error(`Market snapshot is missing required outcome ${outcomeId}.`);
  }

  return quote.label;
}

import type { MarketSnapshot, OutcomeQuote } from "./domain";

export type BeliefByOutcome = Record<OutcomeQuote["outcomeId"], number>;

export type OutcomeDisagreement = {
  outcomeId: OutcomeQuote["outcomeId"];
  label: string;
  marketProbability: number;
  beliefProbability: number;
  disagreementPoints: number;
};

export type BeliefComparison = {
  outcomes: OutcomeDisagreement[];
  strongestPositive: OutcomeDisagreement | null;
  totalBelief: number;
  isValid: boolean;
};

const REQUIRED_OUTCOME_IDS: OutcomeQuote["outcomeId"][] = [
  "participant_1",
  "draw",
  "participant_2",
];

const TOTAL_EPSILON = 0.000001;

export function compareBeliefsToMarket(
  market: MarketSnapshot,
  belief: BeliefByOutcome,
): BeliefComparison {
  const outcomes = REQUIRED_OUTCOME_IDS.map((outcomeId) => {
    const quote = market.outcomes.find((candidate) => candidate.outcomeId === outcomeId);
    if (!quote) {
      throw new Error(`Market snapshot is missing required outcome ${outcomeId}.`);
    }

    const beliefProbability = belief[outcomeId];
    if (!Number.isFinite(beliefProbability) || beliefProbability < 0 || beliefProbability > 1) {
      throw new Error(`Belief probability for ${outcomeId} must be between 0 and 1.`);
    }

    return {
      outcomeId,
      label: quote.label,
      marketProbability: quote.probability,
      beliefProbability,
      disagreementPoints: roundPercentagePoints(beliefProbability - quote.probability),
    };
  });

  const totalBelief = REQUIRED_OUTCOME_IDS.reduce((sum, outcomeId) => sum + belief[outcomeId], 0);
  const strongestPositive = outcomes.reduce<OutcomeDisagreement | null>((strongest, outcome) => {
    if (outcome.disagreementPoints <= 0) {
      return strongest;
    }

    if (!strongest || outcome.disagreementPoints > strongest.disagreementPoints) {
      return outcome;
    }

    return strongest;
  }, null);

  return {
    outcomes,
    strongestPositive,
    totalBelief: roundProbability(totalBelief),
    isValid: Math.abs(totalBelief - 1) <= TOTAL_EPSILON,
  };
}

export function formatPercentage(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function formatDisagreementPoints(points: number): string {
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)} pts`;
}

function roundPercentagePoints(probabilityDelta: number): number {
  return Math.round(probabilityDelta * 1000) / 10;
}

function roundProbability(probability: number): number {
  return Math.round(probability * 1000000) / 1000000;
}

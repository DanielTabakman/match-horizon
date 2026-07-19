import type { OutcomeQuote } from "../domain";

export type ExecutionIntent = {
  outcomeId: OutcomeQuote["outcomeId"];
  requestedStake: number;
  minimumDecimalOdds: number;
  userProbability: number;
};

export type GenericExecutionIntent = {
  selectionId: string;
  requestedStake: number;
  minimumDecimalOdds: number;
  userProbability: number;
};

export type SimulatedQuote = {
  quoteId: string;
  venueId: string;
  venueLabel: string;
  outcomeId: OutcomeQuote["outcomeId"];
  decimalOdds: number;
  availableStake: number;
};

export type GenericExecutableQuote = {
  quoteId: string;
  venueId: string;
  venueLabel: string;
  selectionId: string;
  decimalOdds: number;
  availableStake: number;
};

export type SimulatedFill = {
  quoteId: string;
  venueId: string;
  venueLabel: string;
  outcomeId: OutcomeQuote["outcomeId"];
  decimalOdds: number;
  filledStake: number;
  estimatedGrossPayout: number;
};

export type GenericExecutionFill = {
  quoteId: string;
  venueId: string;
  venueLabel: string;
  selectionId: string;
  decimalOdds: number;
  filledStake: number;
  estimatedGrossPayout: number;
};

export type ExecutionRoute = {
  intent: ExecutionIntent;
  eligibleQuotes: SimulatedQuote[];
  fills: SimulatedFill[];
  requestedStake: number;
  filledStake: number;
  unfilledStake: number;
  weightedAverageOdds: number | null;
  estimatedGrossPayout: number;
  expectedValue: number;
};

export type GenericExecutionRoute = {
  intent: GenericExecutionIntent;
  eligibleQuotes: GenericExecutableQuote[];
  fills: GenericExecutionFill[];
  requestedStake: number;
  filledStake: number;
  unfilledStake: number;
  weightedAverageOdds: number | null;
  estimatedGrossPayout: number;
  expectedValue: number;
};

export function buildExecutionRoute(intent: ExecutionIntent, quotes: SimulatedQuote[]): ExecutionRoute {
  const genericRoute = buildGenericExecutionRoute(
    { ...intent, selectionId: intent.outcomeId },
    quotes.map((quote) => ({ ...quote, selectionId: quote.outcomeId })),
  );

  return {
    ...genericRoute,
    intent: { ...intent },
    eligibleQuotes: genericRoute.eligibleQuotes.map((quote) => ({
      quoteId: quote.quoteId,
      venueId: quote.venueId,
      venueLabel: quote.venueLabel,
      decimalOdds: quote.decimalOdds,
      availableStake: quote.availableStake,
      outcomeId: intent.outcomeId,
    })),
    fills: genericRoute.fills.map((fill) => ({
      quoteId: fill.quoteId,
      venueId: fill.venueId,
      venueLabel: fill.venueLabel,
      decimalOdds: fill.decimalOdds,
      filledStake: fill.filledStake,
      estimatedGrossPayout: fill.estimatedGrossPayout,
      outcomeId: intent.outcomeId,
    })),
  };
}

export function buildGenericExecutionRoute(
  intent: GenericExecutionIntent,
  quotes: GenericExecutableQuote[],
): GenericExecutionRoute {
  validateIntent(intent);
  quotes.forEach(validateQuote);

  const eligibleQuotes = quotes
    .filter(
      (quote) =>
        quote.selectionId === intent.selectionId &&
        quote.decimalOdds >= intent.minimumDecimalOdds &&
        quote.availableStake > 0,
    )
    .sort(compareQuotes);

  let remainingStake = intent.requestedStake;
  const fills: GenericExecutionFill[] = [];

  for (const quote of eligibleQuotes) {
    if (remainingStake <= 0) {
      break;
    }

    const filledStake = roundMoney(Math.min(remainingStake, quote.availableStake));
    if (filledStake <= 0) {
      continue;
    }

    fills.push({
      quoteId: quote.quoteId,
      venueId: quote.venueId,
      venueLabel: quote.venueLabel,
      selectionId: quote.selectionId,
      decimalOdds: quote.decimalOdds,
      filledStake,
      estimatedGrossPayout: roundMoney(filledStake * quote.decimalOdds),
    });
    remainingStake = roundMoney(remainingStake - filledStake);
  }

  const filledStake = roundMoney(fills.reduce((sum, fill) => sum + fill.filledStake, 0));
  const estimatedGrossPayout = roundMoney(
    fills.reduce((sum, fill) => sum + fill.estimatedGrossPayout, 0),
  );
  const weightedAverageOdds = filledStake > 0 ? roundOdds(estimatedGrossPayout / filledStake) : null;
  const unfilledStake = roundMoney(intent.requestedStake - filledStake);
  const expectedValue = roundMoney(intent.userProbability * estimatedGrossPayout - filledStake);

  return {
    intent: { ...intent },
    eligibleQuotes,
    fills,
    requestedStake: intent.requestedStake,
    filledStake,
    unfilledStake,
    weightedAverageOdds,
    estimatedGrossPayout,
    expectedValue,
  };
}

function validateIntent(intent: GenericExecutionIntent) {
  if (!intent.selectionId) {
    throw new Error("Execution selection identifier is required.");
  }

  if (!isPositiveFinite(intent.requestedStake)) {
    throw new Error("Execution requested stake must be greater than 0.");
  }

  if (!isPositiveFinite(intent.minimumDecimalOdds) || intent.minimumDecimalOdds <= 1) {
    throw new Error("Execution minimum decimal odds must be greater than 1.");
  }

  if (!isPositiveFinite(intent.userProbability) || intent.userProbability > 1) {
    throw new Error("Execution user probability must be greater than 0 and no more than 1.");
  }
}

function validateQuote(quote: GenericExecutableQuote) {
  if (!quote.quoteId || !quote.venueId || !quote.venueLabel) {
    throw new Error("Execution quote must include quote and venue identifiers.");
  }

  if (!quote.selectionId) {
    throw new Error(`Execution quote ${quote.quoteId} selection identifier is required.`);
  }

  if (!isPositiveFinite(quote.decimalOdds) || quote.decimalOdds <= 1) {
    throw new Error(`Execution quote ${quote.quoteId} decimal odds must be greater than 1.`);
  }

  if (!isPositiveFinite(quote.availableStake)) {
    throw new Error(`Execution quote ${quote.quoteId} available liquidity must be greater than 0.`);
  }
}

function compareQuotes(left: GenericExecutableQuote, right: GenericExecutableQuote): number {
  if (left.decimalOdds !== right.decimalOdds) {
    return right.decimalOdds - left.decimalOdds;
  }

  const venueComparison = left.venueId.localeCompare(right.venueId);
  if (venueComparison !== 0) {
    return venueComparison;
  }

  return left.quoteId.localeCompare(right.quoteId);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundOdds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

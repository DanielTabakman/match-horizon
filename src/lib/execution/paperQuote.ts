import type { OutcomeQuote } from "../domain";
import type { SimulatedQuote } from "./router";

export const PAPER_PREDICTION_MARKET_VENUE_ID = "paper-prediction-market";
export const PAPER_PREDICTION_MARKET_VENUE_LABEL = "Paper Prediction Market";
export const PAPER_PREDICTION_MARKET_QUOTE_ID = "paper-external-quote";

export function buildPaperPredictionMarketQuote({
  enabled,
  outcomeId,
  decimalOdds,
  availableStake,
}: {
  enabled: boolean;
  outcomeId: OutcomeQuote["outcomeId"] | null;
  decimalOdds: number;
  availableStake: number;
}): SimulatedQuote | null {
  if (!enabled || outcomeId === null || !isValidPaperQuoteInput(decimalOdds, availableStake)) {
    return null;
  }

  return {
    quoteId: PAPER_PREDICTION_MARKET_QUOTE_ID,
    venueId: PAPER_PREDICTION_MARKET_VENUE_ID,
    venueLabel: PAPER_PREDICTION_MARKET_VENUE_LABEL,
    outcomeId,
    decimalOdds,
    availableStake,
  };
}

export function isValidPaperQuoteInput(decimalOdds: number, availableStake: number): boolean {
  return Number.isFinite(decimalOdds) && decimalOdds > 1 && Number.isFinite(availableStake) && availableStake > 0;
}

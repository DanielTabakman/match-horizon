import sxBetObservations from "../../../test-fixtures/market-radar/sx-bet-observations.json";
import polymarketObservations from "../../../test-fixtures/market-radar/polymarket-observations.json";
import kalshiObservations from "../../../test-fixtures/market-radar/kalshi-observations.json";
import type { ExternalMarketObservation } from "./types";
import { validateObservation } from "./validation";

export function loadSxBetFixtureObservations(): ExternalMarketObservation[] {
  return (sxBetObservations as ExternalMarketObservation[]).map(validateObservation);
}

export function loadPolymarketFixtureObservations(): ExternalMarketObservation[] {
  return (polymarketObservations as ExternalMarketObservation[]).map(validateObservation);
}

export function loadKalshiFixtureObservations(): ExternalMarketObservation[] {
  return (kalshiObservations as ExternalMarketObservation[]).map(validateObservation);
}

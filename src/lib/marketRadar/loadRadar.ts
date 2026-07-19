import "server-only";

import { mapObservations } from "./mappings";
import { fetchKalshiObservations } from "./kalshiAdapter";
import { fetchPolymarketObservations } from "./polymarketAdapter";
import { fetchSxBetObservations } from "./sxBetAdapter";
import type { RadarSnapshot } from "./types";

export async function loadMarketRadarSnapshot(): Promise<RadarSnapshot> {
  const results = await Promise.all([fetchSxBetObservations(), fetchKalshiObservations(), fetchPolymarketObservations()]);
  return {
    observedAt: new Date().toISOString(),
    observations: mapObservations(results.flatMap((result) => result.observations)),
    health: results.map((result) => result.health),
  };
}

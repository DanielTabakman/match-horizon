import replaySnapshot from "../../../test-fixtures/replay/france-spain-18237038.json";
import type { TxlineReferenceByOutcome } from "./types";

export const RADAR_TXLINE_REFERENCE: TxlineReferenceByOutcome = Object.fromEntries(
  replaySnapshot.initialMarket.outcomes.map((outcome) => [outcome.outcomeId, outcome.probability]),
);

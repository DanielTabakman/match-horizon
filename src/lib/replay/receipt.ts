import type { ResultReceipt, ScoreEvent } from "../domain";
import { TxlineNormalizationError } from "../txline/normalizationErrors";

export function buildResultReceiptFromScores(fixtureId: string, events: ScoreEvent[]): ResultReceipt {
  const finalEvent = [...events]
    .reverse()
    .find((event) => event.fixtureId === fixtureId && event.eventType === "game_finalised");

  if (!finalEvent) {
    throw new TxlineNormalizationError(
      `No game_finalised score event was found for fixture ${fixtureId}.`,
      "malformed_payload",
    );
  }

  if (finalEvent.score1 === null || finalEvent.score2 === null) {
    throw new TxlineNormalizationError(
      `Final score totals were not present on fixture ${fixtureId} game_finalised event.`,
      "malformed_payload",
    );
  }

  return {
    fixtureId,
    finalScore1: finalEvent.score1,
    finalScore2: finalEvent.score2,
    finalized: true,
    sequence: finalEvent.sequence,
    proofAvailable: false,
    locallyValidated: true,
    onchainValidated: false,
    validationNotes: [
      "TxLINE score snapshot contained a game_finalised event.",
      "Final score was read from Score.Participant*.Total.Goals on that event.",
      "No proof endpoint has been identified yet; on-chain validation was not attempted.",
    ],
  };
}

import { describe, expect, it } from "vitest";
import replayCapture from "../../../test-fixtures/replay/france-spain-18237038.json";
import { buildResultReceiptFromScores } from "./receipt";
import { validateReplay } from "./timeline";
import type { MatchReplay } from "./types";

describe("replay capture validation", () => {
  it("accepts the committed offline France-Spain replay", () => {
    expect(validateReplay(replayCapture as MatchReplay)).toEqual([]);
  });

  it("extracts a final score only from observed TxLINE finalization score totals", () => {
    const events = (replayCapture as MatchReplay).events
      .filter((event) => event.type === "score_event")
      .map((event) => event.payload);
    const receipt = buildResultReceiptFromScores("18237038", events);

    expect(receipt).toMatchObject({
      fixtureId: "18237038",
      finalScore1: 0,
      finalScore2: 2,
      finalized: true,
      sequence: 1026,
      locallyValidated: true,
      onchainValidated: false,
    });
  });

  it("rejects replay files whose receipt disagrees with finalization evidence", () => {
    const invalid = {
      ...(replayCapture as MatchReplay),
      resultReceipt: {
        ...(replayCapture as MatchReplay).resultReceipt,
        finalScore2: 99,
      },
    };

    expect(validateReplay(invalid)).toContain(
      "Replay receipt final score does not match the game_finalised score event.",
    );
  });
});

import { describe, expect, it } from "vitest";
import replayCapture from "../../../test-fixtures/replay/france-spain-18237038.json";
import { normalizeTxlineScoreEvent } from "../txline/normalizeScores";
import { TxlineNormalizationError } from "../txline/normalizationErrors";
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
      proofAvailable: false,
      locallyValidated: false,
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

  it("rejects replay files with playable events before the initial market snapshot", () => {
    const replay = cloneReplay();
    replay.events.unshift({
      occurredAt: "2026-07-14T18:42:08.438Z",
      type: "score_event",
      payload: {
        fixtureId: "18237038",
        occurredAt: "2026-07-14T18:42:08.438Z",
        sequence: 99999,
        eventType: "regression_probe",
        score1: null,
        score2: null,
        period: null,
        rawReference: "regression_probe:99999",
      },
    });

    expect(validateReplay(replay)).toContain(
      "Replay playable events must not predate the initial market snapshot.",
    );
  });

  it("rejects replay files whose finalization event payload differs from the receipt", () => {
    const replay = cloneReplay();
    const finalization = replay.events.find((event) => event.type === "finalization");
    if (!finalization) {
      throw new Error("Expected finalization event in replay capture.");
    }

    finalization.payload = {
      ...finalization.payload,
      finalScore2: 99,
    };

    expect(validateReplay(replay)).toContain(
      "Replay finalization event payload must match the top-level result receipt.",
    );
  });
});

describe("TxLINE replay score-total normalization", () => {
  it("preserves a missing participant score as null", () => {
    expect(normalizeScore({ Participant2: { Total: { Goals: 1 } } })).toMatchObject({
      score1: null,
      score2: 1,
    });
  });

  it("preserves a missing total as null", () => {
    expect(normalizeScore({ Participant1: {}, Participant2: { Total: { Goals: 1 } } })).toMatchObject({
      score1: null,
      score2: 1,
    });
  });

  it("preserves missing goals as null", () => {
    expect(
      normalizeScore({ Participant1: { Total: {} }, Participant2: { Total: { Goals: 1 } } }),
    ).toMatchObject({
      score1: null,
      score2: 1,
    });
  });

  it("fails explicitly for malformed participant, total, or goals fields", () => {
    const malformedScores = [
      { Participant1: "bad" },
      { Participant1: { Total: "bad" } },
      { Participant1: { Total: { Goals: "0" } } },
      { Participant1: { Total: { Goals: -1 } } },
      { Participant1: { Total: { Goals: 1.5 } } },
    ];

    for (const score of malformedScores) {
      expect(() => normalizeScore(score)).toThrow(TxlineNormalizationError);
    }
  });

  it("requires both finalization totals to be observed", () => {
    expect(() =>
      buildResultReceiptFromScores("fixture-1", [
        {
          fixtureId: "fixture-1",
          occurredAt: "2026-07-14T21:04:14.751Z",
          sequence: 1,
          eventType: "game_finalised",
          score1: null,
          score2: 2,
          period: null,
          rawReference: "game_finalised:1",
        },
      ]),
    ).toThrow(TxlineNormalizationError);
  });
});

function normalizeScore(score: unknown) {
  return normalizeTxlineScoreEvent({
    FixtureId: "fixture-1",
    Ts: Date.parse("2026-07-14T20:00:00.000Z"),
    Seq: 1,
    Action: "score_probe",
    Score: score,
  });
}

function cloneReplay(): MatchReplay {
  return JSON.parse(JSON.stringify(replayCapture)) as MatchReplay;
}

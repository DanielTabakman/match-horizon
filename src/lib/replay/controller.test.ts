import { describe, expect, it } from "vitest";
import replayCapture from "../../../test-fixtures/replay/france-spain-18237038.json";
import type { MatchReplay } from "./types";
import { freezeEvaluationSnapshot, projectReplay, settleExpression } from "./controller";

const replay = replayCapture as MatchReplay;

describe("replay controller", () => {
  it("freezes a valid strongest positive expression snapshot", () => {
    const snapshot = freezeEvaluationSnapshot(
      replay.initialMarket,
      {
        participant_1: 0.3,
        draw: 0.25,
        participant_2: 0.45,
      },
      "2026-07-16T19:00:00.000Z",
    );

    expect(snapshot).toMatchObject({
      selectedExpression: "participant_2",
      strongestPositive: {
        outcomeId: "participant_2",
        label: "Spain",
      },
      belief: {
        participant_2: 0.45,
      },
    });
  });

  it("does not freeze invalid or non-positive expressions", () => {
    expect(
      freezeEvaluationSnapshot(
        replay.initialMarket,
        {
          participant_1: 0.3,
          draw: 0.31,
          participant_2: 0.3,
        },
        "2026-07-16T19:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("preserves unknown score until an event contains observed score totals", () => {
    expect(projectReplay(replay, 0).score).toEqual({ score1: null, score2: null });
    expect(projectReplay(replay, 3).score).toEqual({ score1: null, score2: null });
    expect(projectReplay(replay, 4).score).toEqual({ score1: 0, score2: 1 });
  });

  it("projects the same state after restart and replay to the same cursor", () => {
    const firstRun = projectReplay(replay, 12);
    const restartedRun = projectReplay(replay, 0);
    const secondRun = projectReplay(replay, 12);

    expect(restartedRun.score).toEqual({ score1: null, score2: null });
    expect(secondRun).toEqual(firstRun);
  });

  it("settles the selected three-way expression from the observed final score", () => {
    const finalProjection = projectReplay(replay, replay.events.length);
    if (!finalProjection.finalizedReceipt) {
      throw new Error("Expected final replay projection to contain a receipt.");
    }

    expect(finalProjection.score).toEqual({ score1: 0, score2: 2 });
    expect(
      settleExpression("participant_2", finalProjection.finalizedReceipt, replay.initialMarket),
    ).toEqual({
      outcomeId: "participant_2",
      label: "Spain",
      occurred: true,
    });
    expect(
      settleExpression("participant_1", finalProjection.finalizedReceipt, replay.initialMarket),
    ).toMatchObject({
      occurred: false,
    });
  });
});

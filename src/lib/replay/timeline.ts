import type { ResultReceipt, ScoreEvent } from "../domain";
import type { MatchReplay, ReplayEvent } from "./types";

export function buildReplayEvents(
  scoreEvents: ScoreEvent[],
  receipt: ResultReceipt,
  replayStartsAt: string,
): ReplayEvent[] {
  const events: ReplayEvent[] = scoreEvents
    .filter((event) => Date.parse(event.occurredAt) >= Date.parse(replayStartsAt))
    .map((event) => ({
      occurredAt: event.occurredAt,
      type: "score_event",
      payload: event,
    }));

  const finalEvent = scoreEvents.find((event) => event.sequence === receipt.sequence);
  events.push({
    occurredAt: finalEvent?.occurredAt ?? scoreEvents.at(-1)?.occurredAt ?? new Date(0).toISOString(),
    type: "finalization",
    payload: receipt,
  });

  return sortReplayEvents(events);
}

export function sortReplayEvents(events: ReplayEvent[]): ReplayEvent[] {
  return [...events].sort((left, right) => {
    const timeDelta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return eventSequence(left) - eventSequence(right);
  });
}

export function validateReplay(replay: MatchReplay): string[] {
  const errors: string[] = [];

  if (replay.schemaVersion !== 1) {
    errors.push("Replay schemaVersion must be 1.");
  }

  if (replay.fixture.fixtureId !== replay.initialMarket.fixtureId) {
    errors.push("Replay fixture and initial market fixture ids differ.");
  }

  if (replay.fixture.fixtureId !== replay.resultReceipt.fixtureId) {
    errors.push("Replay fixture and result receipt fixture ids differ.");
  }

  const sorted = sortReplayEvents(replay.events);
  if (JSON.stringify(sorted) !== JSON.stringify(replay.events)) {
    errors.push("Replay events are not in stable chronological order.");
  }

  const scoreEvents = replay.events.filter((event) => event.type === "score_event");
  if (scoreEvents.length === 0) {
    errors.push("Replay must contain at least one score event.");
  }

  const finalizationEvents = replay.events.filter((event) => event.type === "finalization");
  if (finalizationEvents.length !== 1) {
    errors.push("Replay must contain exactly one finalization event.");
  }

  const receipt = replay.resultReceipt;
  if (!receipt.finalized) {
    errors.push("Replay result receipt must be finalized.");
  }

  if (receipt.finalScore1 < 0 || receipt.finalScore2 < 0) {
    errors.push("Replay final scores must be non-negative.");
  }

  const marketCapturedAtMs = Date.parse(replay.initialMarket.capturedAt);
  if (!Number.isFinite(marketCapturedAtMs)) {
    errors.push("Replay initial market capturedAt must be a valid timestamp.");
  } else if (
    replay.events.some((event) => Date.parse(event.occurredAt) < marketCapturedAtMs)
  ) {
    errors.push("Replay playable events must not predate the initial market snapshot.");
  }

  if (
    finalizationEvents.length === 1 &&
    JSON.stringify(finalizationEvents[0].payload) !== JSON.stringify(receipt)
  ) {
    errors.push("Replay finalization event payload must match the top-level result receipt.");
  }

  const finalScoreEvent = scoreEvents
    .map((event) => event.payload)
    .find((event) => event.sequence === receipt.sequence && event.eventType === "game_finalised");

  if (!finalScoreEvent) {
    errors.push("Replay receipt sequence must reference a game_finalised score event.");
  } else if (
    finalScoreEvent.score1 !== receipt.finalScore1 ||
    finalScoreEvent.score2 !== receipt.finalScore2
  ) {
    errors.push("Replay receipt final score does not match the game_finalised score event.");
  }

  return errors;
}

function eventSequence(event: ReplayEvent): number {
  if (event.type === "score_event") {
    return event.payload.sequence ?? Number.MAX_SAFE_INTEGER - 1;
  }

  return event.payload.sequence ?? Number.MAX_SAFE_INTEGER;
}

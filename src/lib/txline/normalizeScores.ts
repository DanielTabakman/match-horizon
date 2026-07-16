import type { ScoreEvent } from "../domain";
import { TxlineNormalizationError } from "./normalizationErrors";
import type { TxlineScoreRecord } from "./schemas";

export function normalizeTxlineScoreEvents(records: TxlineScoreRecord[]): ScoreEvent[] {
  return records.map(normalizeTxlineScoreEvent).sort((left, right) => {
    const sequenceDelta = (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER);
    return sequenceDelta || Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  });
}

export function normalizeTxlineScoreEvent(record: TxlineScoreRecord): ScoreEvent {
  const fixtureId = requiredStringish(record.FixtureId, "FixtureId");
  const sequence = optionalNumber(record.Seq, "Seq");
  const eventType = requiredString(record.Action, "Action");
  const occurredAt = requiredMillisToIso(record.Ts, "Ts");
  const score = optionalScore(record.Score);

  return {
    fixtureId,
    occurredAt,
    sequence,
    eventType,
    score1: score?.score1 ?? null,
    score2: score?.score2 ?? null,
    period: null,
    rawReference: sequence === null ? eventType : `${eventType}:${sequence}`,
  };
}

function requiredStringish(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  throw new TxlineNormalizationError(`Score record is missing ${field}.`, "malformed_payload");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  throw new TxlineNormalizationError(`Score record is missing ${field}.`, "malformed_payload");
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TxlineNormalizationError(`Score ${field} must be finite when present.`, "ambiguous_data");
  }

  return value;
}

function requiredMillisToIso(value: unknown, field: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TxlineNormalizationError(`Score ${field} must be a finite millisecond timestamp.`, "malformed_payload");
  }

  return new Date(value).toISOString();
}

function optionalScore(value: unknown): { score1: number | null; score2: number | null } | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object") {
    throw new TxlineNormalizationError("Score field must be an object when present.", "ambiguous_data");
  }

  const participant1 = (value as Record<string, unknown>).Participant1;
  const participant2 = (value as Record<string, unknown>).Participant2;

  return {
    score1: optionalGoals(participant1, "Participant1"),
    score2: optionalGoals(participant2, "Participant2"),
  };
}

function optionalGoals(value: unknown, participant: string): number | null {
  if (value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TxlineNormalizationError(
      `Score ${participant} must be an object when present.`,
      "ambiguous_data",
    );
  }

  const total = (value as Record<string, unknown>).Total;
  if (total === undefined) {
    return null;
  }

  if (!total || typeof total !== "object" || Array.isArray(total)) {
    throw new TxlineNormalizationError(
      `Score ${participant}.Total must be an object when present.`,
      "ambiguous_data",
    );
  }

  const goals = (total as Record<string, unknown>).Goals;
  if (goals === undefined) {
    return null;
  }

  if (typeof goals !== "number" || !Number.isInteger(goals) || goals < 0) {
    throw new TxlineNormalizationError(
      `Score ${participant}.Total.Goals must be a non-negative integer when present.`,
      "ambiguous_data",
    );
  }

  return goals;
}

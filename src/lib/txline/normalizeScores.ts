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

  return {
    fixtureId,
    occurredAt,
    sequence,
    eventType,
    score1: null,
    score2: null,
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

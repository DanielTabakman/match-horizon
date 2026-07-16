import type { Fixture, FixtureStatus } from "../domain";
import { TxlineNormalizationError } from "./normalizationErrors";
import type { TxlineFixtureRecord } from "./schemas";

export function normalizeTxlineFixture(record: TxlineFixtureRecord): Fixture {
  const fixtureId = requiredStringish(record.FixtureId, "FixtureId");
  const participant1 = requiredString(record.Participant1, "Participant1");
  const participant2 = requiredString(record.Participant2, "Participant2");

  return {
    fixtureId,
    participant1,
    participant2,
    startsAt: optionalMillisToIso(record.StartTime, "StartTime"),
    status: normalizeFixtureStatus(record.GameState),
  };
}

function normalizeFixtureStatus(value: unknown): FixtureStatus {
  if (typeof value !== "string") {
    return "unknown";
  }

  if (["scheduled", "live", "finished", "cancelled"].includes(value)) {
    return value as FixtureStatus;
  }

  return "unknown";
}

function requiredStringish(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  throw new TxlineNormalizationError(`Fixture record is missing ${field}.`, "malformed_payload");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  throw new TxlineNormalizationError(`Fixture record is missing ${field}.`, "malformed_payload");
}

function optionalMillisToIso(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TxlineNormalizationError(`Fixture ${field} must be a finite millisecond timestamp.`, "ambiguous_data");
  }

  return new Date(value).toISOString();
}

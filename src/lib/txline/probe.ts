import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TxlineClient } from "./client";
import type { TxlineConfig } from "./env";
import { TxlineProbeError } from "./errors";
import {
  collectObjectKeys,
  getRecordCount,
  getRecords,
  getRepresentativeRecord,
  sanitizeForSample,
} from "./sample";

export type ProbeResult = {
  fixtureId: string;
  fixtureCount: number;
  oddsCount: number;
  scoreCount: number;
  scoreSource: "snapshot" | "historical" | "updates" | "none";
  scoreNote: string | null;
  sampleDirectory: string;
  fixtureKeys: string[];
  oddsKeys: string[];
  scoreKeys: string[];
};

export async function runTxlineProbe(config: TxlineConfig): Promise<ProbeResult> {
  const client = new TxlineClient(config);
  const capturedAt = new Date().toISOString();

  const fixturesPayload = await client.fixturesSnapshot;
  const fixtures = requireRecords(fixturesPayload, "fixtures snapshot");
  const selectedFixture = selectWorldCupFixture(fixtures, config.demoFixtureId);
  const fixtureId = getFixtureId(selectedFixture);

  const oddsPayload = await client.getOddsSnapshot(fixtureId);
  requireRecords(oddsPayload, "odds snapshot");

  const scoreResult = await fetchBestScoreData(client, fixtureId);
  const sampleDirectory = join(process.cwd(), "test-fixtures", "txline");
  await mkdir(sampleDirectory, { recursive: true });
  await writeSample(sampleDirectory, "fixtures-snapshot.json", capturedAt, fixturesPayload);
  await writeSample(sampleDirectory, "odds-snapshot.json", capturedAt, oddsPayload);
  await writeSample(sampleDirectory, "scores-sample.json", capturedAt, scoreResult.payload);

  return {
    fixtureId,
    fixtureCount: getRecordCount(fixturesPayload),
    oddsCount: getRecordCount(oddsPayload),
    scoreCount: getRecordCount(scoreResult.payload),
    scoreSource: scoreResult.source,
    scoreNote: scoreResult.note,
    sampleDirectory,
    fixtureKeys: collectObjectKeys(getRepresentativeRecord(fixturesPayload)),
    oddsKeys: collectObjectKeys(getRepresentativeRecord(oddsPayload)),
    scoreKeys: collectObjectKeys(getRepresentativeRecord(scoreResult.payload)),
  };
}

export function selectWorldCupFixture(records: unknown[], configuredFixtureId: string | null) {
  if (configuredFixtureId) {
    const configured = records.find((record) => getFixtureId(record) === configuredFixtureId);
    if (!configured) {
      throw new TxlineProbeError(
        `Configured TXLINE_DEMO_FIXTURE_ID ${configuredFixtureId} was not found in the fixtures snapshot.`,
        "empty_results",
      );
    }

    return configured;
  }

  const worldCupFixture = records.find((record) =>
    collectStringValues(record).some((value) => /world cup/i.test(value)),
  );

  if (!worldCupFixture) {
    throw new TxlineProbeError(
      "No discoverable World Cup fixture was found in the fixtures snapshot. Set TXLINE_DEMO_FIXTURE_ID to a fixture from the current TxLINE World Cup subscription.",
      "empty_results",
    );
  }

  return worldCupFixture;
}

async function fetchBestScoreData(client: TxlineClient, fixtureId: string) {
  const attempts = [
    { source: "snapshot" as const, fetch: () => client.getScoresSnapshot(fixtureId) },
    { source: "historical" as const, fetch: () => client.getScoresHistorical(fixtureId) },
    { source: "updates" as const, fetch: () => client.getScoresUpdates(fixtureId) },
  ];

  const emptySources: string[] = [];
  for (const attempt of attempts) {
    const payload = await attempt.fetch();
    if (getRecordCount(payload) > 0) {
      return { source: attempt.source, payload, note: null };
    }

    emptySources.push(attempt.source);
  }

  return {
    source: "none" as const,
    payload: [],
    note: `No score records returned from ${emptySources.join(", ")} for fixture ${fixtureId}. This is accepted only if the selected fixture has no current or eligible historical score data.`,
  };
}

function requireRecords(payload: unknown, label: string) {
  const records = getRecords(payload);
  if (!records) {
    throw new TxlineProbeError(
      `TxLINE ${label} payload was malformed. Expected an array or an object containing a record array.`,
      "malformed_payload",
    );
  }

  if (records.length === 0) {
    throw new TxlineProbeError(`TxLINE ${label} returned no records.`, "empty_results");
  }

  return records;
}

function getFixtureId(record: unknown) {
  if (!record || typeof record !== "object") {
    throw new TxlineProbeError("Selected fixture is not an object.", "malformed_payload");
  }

  const value =
    "FixtureId" in record
      ? record.FixtureId
      : "fixtureId" in record
        ? record.fixtureId
        : "id" in record
          ? record.id
          : null;

  if (typeof value !== "number" && typeof value !== "string") {
    throw new TxlineProbeError(
      "Selected fixture does not contain a recognizable fixture id field.",
      "malformed_payload",
    );
  }

  return String(value);
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringValues);
  }

  return [];
}

async function writeSample(
  sampleDirectory: string,
  filename: string,
  capturedAt: string,
  payload: unknown,
) {
  const sample = {
    schemaVersion: 1,
    capturedAt,
    recordCount: getRecordCount(payload),
    representativeKeys: collectObjectKeys(getRepresentativeRecord(payload)),
    sample: sanitizeForSample(payload),
  };

  await writeFile(join(sampleDirectory, filename), `${JSON.stringify(sample, null, 2)}\n`, "utf8");
}

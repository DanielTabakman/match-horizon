import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import fixturesCapture from "../test-fixtures/txline/fixtures-snapshot.json";
import oddsCapture from "../test-fixtures/txline/odds-snapshot.json";
import { normalizeTxlineFixture } from "../src/lib/txline/normalizeFixture";
import { normalizeTxlineMatchResultMarket } from "../src/lib/txline/normalizeOdds";
import { normalizeTxlineScoreEvents } from "../src/lib/txline/normalizeScores";
import type { TxlineScoreRecord } from "../src/lib/txline/schemas";
import { buildResultReceiptFromScores } from "../src/lib/replay/receipt";
import { buildReplayEvents, validateReplay } from "../src/lib/replay/timeline";
import type { MatchReplay, ReplayEndpointFinding } from "../src/lib/replay/types";
import { TxlineClient } from "../src/lib/txline/client";
import { getTxlineConfig, loadLocalEnvFiles } from "../src/lib/txline/env";
import { getRecordCount, getRecords } from "../src/lib/txline/sample";

const replayFixtureId = process.env.TXLINE_REPLAY_FIXTURE_ID?.trim() || "18237038";

async function main() {
  loadLocalEnvFiles();
  const config = getTxlineConfig();
  const client = new TxlineClient(config);
  const capturedAt = new Date().toISOString();

  const fixtureRecord = fixturesCapture.sample.find(
    (record) => String(record.FixtureId) === replayFixtureId,
  );
  if (!fixtureRecord) {
    throw new Error(`Fixture ${replayFixtureId} was not found in committed TxLINE fixture captures.`);
  }

  const fixture = normalizeTxlineFixture(fixtureRecord);
  const initialMarket = normalizeTxlineMatchResultMarket(
    oddsCapture.sample,
    fixture,
    oddsCapture.capturedAt,
  );

  const endpointFindings: ReplayEndpointFinding[] = [];
  endpointFindings.push(await probeEndpoint("/api/fixtures/snapshot", () => client.fixturesSnapshot));
  endpointFindings.push(
    await probeEndpoint(`/api/odds/snapshot/${replayFixtureId}`, () =>
      client.getOddsSnapshot(replayFixtureId),
    ),
  );
  endpointFindings.push(
    await probeEndpoint(`/api/scores/historical/${replayFixtureId}`, () =>
      client.getScoresHistorical(replayFixtureId),
    ),
  );
  endpointFindings.push(
    await probeEndpoint(`/api/scores/updates/${replayFixtureId}`, () =>
      client.getScoresUpdates(replayFixtureId),
    ),
  );

  const scorePayload = await client.getScoresSnapshot(replayFixtureId);
  const scoreRecords = getRecords(scorePayload);
  if (!scoreRecords) {
    throw new Error(`TxLINE score snapshot for fixture ${replayFixtureId} was not a record array.`);
  }

  endpointFindings.push({
    endpoint: `/api/scores/snapshot/${replayFixtureId}`,
    result: scoreRecords.length > 0 ? "records" : "empty",
    recordCount: scoreRecords.length,
    note: "Used as the replay score source.",
  });

  const scoreEvents = normalizeTxlineScoreEvents(scoreRecords as TxlineScoreRecord[]);
  const resultReceipt = buildResultReceiptFromScores(fixture.fixtureId, scoreEvents);
  const replay: MatchReplay = {
    schemaVersion: 1,
    capturedAt,
    fixture,
    initialMarket,
    events: buildReplayEvents(scoreEvents, resultReceipt),
    resultReceipt,
    source: {
      fixture: "test-fixtures/txline/fixtures-snapshot.json captured on 2026-07-14",
      initialMarket:
        "test-fixtures/txline/odds-snapshot.json captured on 2026-07-14; completed-fixture live odds snapshot is now empty",
      scores: `/api/scores/snapshot/${replayFixtureId}`,
      endpointFindings,
    },
  };

  const errors = validateReplay(replay);
  if (errors.length > 0) {
    throw new Error(`Replay validation failed:\n${errors.join("\n")}`);
  }

  const outputDirectory = join(process.cwd(), "test-fixtures", "replay");
  const outputPath = join(outputDirectory, `france-spain-${replayFixtureId}.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(replay, null, 2)}\n`, "utf8");

  console.log(`Captured replay fixture: ${fixture.fixtureId}`);
  console.log(`Final score: ${resultReceipt.finalScore1}-${resultReceipt.finalScore2}`);
  console.log(`Score events: ${scoreEvents.length}`);
  console.log(`Replay events: ${replay.events.length}`);
  console.log(`Saved replay: ${outputPath}`);
}

async function probeEndpoint(
  endpoint: string,
  fetchPayload: () => Promise<unknown>,
): Promise<ReplayEndpointFinding> {
  try {
    const payload = await fetchPayload();
    const recordCount = getRecordCount(payload);
    return {
      endpoint,
      result: recordCount > 0 ? "records" : "empty",
      recordCount,
      note: recordCount > 0 ? "Endpoint returned records." : "Endpoint returned no records.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      endpoint,
      result: /non-JSON/i.test(message) ? "non_json" : "error",
      recordCount: null,
      note: message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 240),
    };
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

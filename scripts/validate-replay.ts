import { readFile } from "node:fs/promises";
import replayCapture from "../test-fixtures/replay/france-spain-18237038.json";
import { validateReplay } from "../src/lib/replay/timeline";
import type { MatchReplay } from "../src/lib/replay/types";

async function main() {
  const replayPath = process.argv[2];
  const replay = replayPath
    ? (JSON.parse(await readFile(replayPath, "utf8")) as MatchReplay)
    : (replayCapture as MatchReplay);

  const errors = validateReplay(replay);
  if (errors.length > 0) {
    console.error(`Replay validation failed:\n${errors.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Replay validation passed for fixture ${replay.fixture.fixtureId}.`);
  console.log(
    `Final result: ${replay.resultReceipt.finalScore1}-${replay.resultReceipt.finalScore2}`,
  );
  console.log(`Events: ${replay.events.length}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

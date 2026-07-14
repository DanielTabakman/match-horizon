import { getTxlineConfig, loadLocalEnvFiles } from "../src/lib/txline/env";
import { TxlineProbeError } from "../src/lib/txline/errors";
import { runTxlineProbe } from "../src/lib/txline/probe";

async function main() {
  loadLocalEnvFiles();
  const config = getTxlineConfig();
  const result = await runTxlineProbe(config);

  console.log("TxLINE authentication succeeded.");
  console.log(`Fixture found: ${result.fixtureId}`);
  console.log(`Fixture records: ${result.fixtureCount}`);
  console.log(`Fixture representative keys: ${result.fixtureKeys.join(", ") || "(none)"}`);
  console.log(`Odds records: ${result.oddsCount}`);
  console.log(`Odds representative keys: ${result.oddsKeys.join(", ") || "(none)"}`);
  console.log(`Score source: ${result.scoreSource}`);
  console.log(`Score records: ${result.scoreCount}`);
  console.log(`Score representative keys: ${result.scoreKeys.join(", ") || "(none)"}`);
  if (result.scoreNote) {
    console.log(`Score note: ${result.scoreNote}`);
  }
  console.log(`Sanitized samples saved: ${result.sampleDirectory}`);
}

main().catch((error: unknown) => {
  if (error instanceof TxlineProbeError) {
    console.error(`TxLINE probe failed [${error.code}]: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});

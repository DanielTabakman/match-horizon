import BeliefComparisonClient from "./BeliefComparisonClient";
import type { SnapshotState } from "./BeliefComparisonClient";
import { loadDemoSnapshot } from "../src/lib/txline/demoSnapshot";
import { TxlineNormalizationError } from "../src/lib/txline/normalizationErrors";

export default function Home() {
  let snapshotState: SnapshotState;

  try {
    const snapshot = loadDemoSnapshot();

    if (!snapshot) {
      snapshotState = { status: "empty" };
    } else {
      snapshotState = { status: "ready", ...snapshot };
    }
  } catch (error) {
    if (error instanceof TxlineNormalizationError && error.code === "unsupported_market") {
      snapshotState = {
        status: "unsupported-market",
        message: error.message,
      };
    } else {
      snapshotState = {
        status: "error",
        message: error instanceof Error ? error.message : "The committed TxLINE snapshot could not be loaded.",
      };
    }
  }

  return <BeliefComparisonClient snapshot={snapshotState} />;
}

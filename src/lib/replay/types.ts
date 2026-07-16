import type { Fixture, MarketSnapshot, ResultReceipt, ScoreEvent } from "../domain";

export type ReplayEvent =
  | {
      occurredAt: string;
      type: "score_event";
      payload: ScoreEvent;
    }
  | {
      occurredAt: string;
      type: "finalization";
      payload: ResultReceipt;
    };

export type ReplayEndpointFinding = {
  endpoint: string;
  result: "records" | "empty" | "non_json" | "error";
  recordCount: number | null;
  note: string;
};

export type MatchReplay = {
  schemaVersion: 1;
  capturedAt: string;
  fixture: Fixture;
  initialMarket: MarketSnapshot;
  events: ReplayEvent[];
  resultReceipt: ResultReceipt;
  source: {
    fixture: string;
    initialMarket: string;
    scores: string;
    endpointFindings: ReplayEndpointFinding[];
  };
};

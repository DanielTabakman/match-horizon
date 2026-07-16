export type FixtureStatus = "scheduled" | "live" | "finished" | "cancelled" | "unknown";

export type Fixture = {
  fixtureId: string;
  participant1: string;
  participant2: string;
  startsAt: string | null;
  status: FixtureStatus;
};

export type OutcomeQuote = {
  outcomeId: "participant_1" | "draw" | "participant_2";
  label: string;
  probability: number;
};

export type MarketSnapshot = {
  fixtureId: string;
  marketType: "match_result";
  capturedAt: string;
  outcomes: OutcomeQuote[];
  source: "txline_live" | "txline_historical" | "txline_capture";
};

export type ScoreEvent = {
  fixtureId: string;
  occurredAt: string;
  sequence: number | null;
  eventType: string;
  score1: number | null;
  score2: number | null;
  period: string | null;
  rawReference: string | null;
};

export type ResultReceipt = {
  fixtureId: string;
  finalScore1: number;
  finalScore2: number;
  finalized: boolean;
  sequence: number | null;
  proofAvailable: boolean;
  locallyValidated: boolean;
  onchainValidated: boolean;
  validationNotes: string[];
};

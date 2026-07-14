export type TxlineFixtureRecord = {
  FixtureId?: unknown;
  Participant1?: unknown;
  Participant2?: unknown;
  StartTime?: unknown;
  GameState?: unknown;
};

export type TxlineOddsRecord = {
  FixtureId?: unknown;
  Ts?: unknown;
  SuperOddsType?: unknown;
  MarketPeriod?: unknown;
  MarketParameters?: unknown;
  PriceNames?: unknown;
  Pct?: unknown;
};

export type TxlineScoreRecord = {
  FixtureId?: unknown;
  Ts?: unknown;
  Seq?: unknown;
  Action?: unknown;
};

export type TxlineSampleEnvelope<T> = {
  schemaVersion: number;
  capturedAt: string;
  recordCount: number;
  representativeKeys: string[];
  sample: T[];
};

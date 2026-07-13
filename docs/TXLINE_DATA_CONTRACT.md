# TxLINE Data Contract

This document defines how Match Horizon may consume TxLINE data.

## Principle

Observed payloads are authoritative. Documentation guides the probe, but implementation must be based on captured real responses.

## Expected data categories

The initial probe should attempt to retrieve:

1. Fixture snapshot or schedule
2. Fixture-specific odds snapshot
3. Fixture-specific score snapshot
4. Historical score sequence for a completed fixture
5. Historical odds updates or time-addressable odds snapshots
6. Proof or validation data for a final score record

Exact endpoints, authentication headers, and fields must be confirmed during implementation.

## Credential handling

- All credentials are environment variables.
- All authenticated TxLINE requests occur server-side or in local capture scripts.
- No credential may be serialized into client props.
- No credential may be logged.
- Sanitized fixtures must remove tokens, sensitive headers, and unrelated identifying data.
- Do not copy environment files from MSOS or Autobuilder.

## Raw schema isolation

Raw payload types live only under:

```text
src/lib/txline/
```

Suggested files:

```text
client.ts
schemas.ts
normalizeFixture.ts
normalizeOdds.ts
normalizeScores.ts
normalizeProof.ts
```

## Normalized domain types

```ts
type FixtureStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "cancelled"
  | "unknown";

type Fixture = {
  fixtureId: string;
  participant1: string;
  participant2: string;
  startsAt: string | null;
  status: FixtureStatus;
};

type OutcomeQuote = {
  outcomeId: "participant_1" | "draw" | "participant_2";
  label: string;
  probability: number;
};

type MarketSnapshot = {
  fixtureId: string;
  marketType: "match_result";
  capturedAt: string;
  outcomes: OutcomeQuote[];
  source: "txline_live" | "txline_historical" | "txline_capture";
};

type ScoreEvent = {
  fixtureId: string;
  occurredAt: string;
  sequence: number | null;
  eventType: string;
  score1: number | null;
  score2: number | null;
  period: string | null;
  rawReference: string | null;
};

type ResultReceipt = {
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
```

These are proposed domain shapes, not claims about TxLINE's raw schema. They may be adjusted after the probe while preserving the domain boundary.

## Odds normalization rules

The implementation must not assume:

- which record represents full-match three-way result;
- the ordering of outcomes;
- the numeric scale of probability fields;
- that every fixture contains the market;
- that price names map to participants without inspection.

Before normalization is accepted, the captured sample must document:

- market identifier or type;
- market period;
- price or outcome names;
- raw probability values;
- participant mapping;
- observed total probability.

## Probability invariants

After normalization:

- each probability is finite;
- each probability is between 0 and 1;
- there are exactly three supported outcomes;
- outcome identifiers are unique;
- the sum is within 0.01 of 1.00.

Ambiguous data must return an explicit unsupported-market error.

## Replay capture format

```json
{
  "schemaVersion": 1,
  "capturedAt": "ISO-8601 timestamp",
  "fixture": {},
  "initialMarket": {},
  "events": [
    {
      "occurredAt": "ISO-8601 timestamp",
      "type": "odds_update | score_event | finalization",
      "payload": {}
    }
  ],
  "resultReceipt": {}
}
```

## Verification language

The UI must use precise labels:

- **TxLINE data received** — raw data came from TxLINE.
- **Proof available** — a proof payload exists.
- **Proof structure checked** — local structural validation passed.
- **On-chain validated** — the application actually executed the documented read-only validation and received success.

Never collapse these into a generic “verified on Solana” label unless the implemented state supports it.

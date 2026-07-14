# Observed TxLINE Phase 2 Data

Source: committed sanitized captures in `test-fixtures/txline/`, captured on `2026-07-14T18:42:08.439Z`.

## Fixture

- Supported fixture used by tests: `18237038`
- Competition observed: `World Cup`
- Participant mapping observed on the fixture record:
  - `Participant1`: `France`
  - `Participant2`: `Spain`
- `StartTime` is an epoch-millisecond value and is normalized to ISO-8601.
- Fixture `GameState` is numeric in the fixture capture. No numeric status meaning is inferred; normalized status is `unknown`.

## Market

- Supported market identifier observed: `SuperOddsType = "1X2_PARTICIPANT_RESULT"`
- Supported full-match period observed: `MarketPeriod = null`
- Supported full-match parameters observed: `MarketParameters = null`
- A separate observed `MarketPeriod = "half=1"` record is not normalized as full-match.
- Supported semantic outcome-name set, independent of source-array order:
  - `part1` -> normalized `participant_1` -> fixture `Participant1`
  - `draw` -> normalized `draw`
  - `part2` -> normalized `participant_2` -> fixture `Participant2`
- `PriceNames` and `Pct` are treated as aligned arrays: each price name is paired with the probability at the same source index, then normalized outcomes are emitted in canonical domain order (`participant_1`, `draw`, `participant_2`).
- Probability scale observed: `Pct` contains percentage strings, for example `"37.272"`, divided by `100` for normalized probabilities.
- Observed full-match total: `37.272 + 31.837 + 30.893 = 100.002`, accepted within the `0.01` normalized tolerance.

## Scores

- Score-feed records were observed for fixture `18237038`.
- Observed event fields used by the normalizer:
  - `Action` -> normalized `eventType`
  - `Seq` -> normalized `sequence`
  - `Ts` -> normalized `occurredAt`
- The committed score sample does not contain observed score-total fields. Normalized `score1`, `score2`, and `period` remain `null` until a captured payload proves those fields.

## Unsupported Or Ambiguous Data

The Phase 2 adapter fails explicitly when:

- no full-match `1X2_PARTICIPANT_RESULT` market exists for the fixture;
- multiple supported full-match records exist in one normalization call;
- the semantic outcome-name set is not exactly `part1`, `draw`, and `part2`;
- outcome names are missing, unknown, or duplicated;
- `PriceNames` and `Pct` are not equal-length arrays with exactly three entries;
- probabilities are blank, non-finite, outside `[0, 1]`, missing, or do not total within `0.01` of `1.00`;
- required fixture or score event fields are missing.

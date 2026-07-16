# Replay Capture Notes

Captured replay fixture: `18237038`, France vs Spain.

The committed replay file is `test-fixtures/replay/france-spain-18237038.json`.

## Data Used

- Fixture metadata: committed sanitized TxLINE fixture snapshot captured on `2026-07-14T18:42:08.439Z`.
- Initial market: committed sanitized TxLINE odds snapshot captured on `2026-07-14T18:42:08.439Z`.
- Score replay: TxLINE `/api/scores/snapshot/18237038` captured on `2026-07-16T18:02:13.363Z`.

The replay reaches `game_finalised` at sequence `1026` with final score France `0`, Spain `2`. The final result is read only from observed `Score.Participant*.Total.Goals` on that finalization event.

## Endpoint Findings

- `/api/fixtures/snapshot` returned records.
- `/api/odds/snapshot/18237038` returned no records for the completed fixture during replay capture.
- `/api/scores/historical/18237038` returned non-JSON data.
- `/api/scores/updates/18237038` returned non-JSON data.
- `/api/scores/snapshot/18237038` returned `40` score records and is the replay score source.

Historical odds movement is therefore not captured yet. The replay keeps the real initial market snapshot fixed and documents that limitation.

## Commands

```bash
npm run txline:capture-replay
npm run replay:validate
```

`npm run replay:validate` loads the committed replay without network access and verifies chronological ordering, finalization, and receipt-score consistency.

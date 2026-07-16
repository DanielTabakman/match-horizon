# Technical Submission Summary

Public demo: https://match-horizon.vercel.app

Match Horizon is a Next.js hackathon prototype that translates captured TxLINE World Cup data into a deterministic market-belief comparison flow.

## What It Does

The app opens a real France vs Spain World Cup fixture, displays normalized TxLINE three-way match-result probabilities, accepts a user's personal probabilities, calculates the strongest positive disagreement, recommends the plain supported match-result expression, replays the completed fixture, and shows a TxLINE-data-backed result receipt.

The implemented flow is:

```text
Market belief -> personal belief -> disagreement -> expression -> deterministic replay -> result receipt
```

## TxLINE Integration

The demo uses committed sanitized TxLINE captures:

- Fixture metadata from `/api/fixtures/snapshot`.
- Initial odds from `test-fixtures/txline/odds-snapshot.json`, originally captured from fixture-specific odds data on `2026-07-14T18:42:08.439Z`.
- Score replay from `/api/scores/snapshot/18237038`, captured on `2026-07-16T18:02:13.363Z`.

The supported market is `1X2_PARTICIPANT_RESULT` with full-match period and parameters set to `null`. The raw `Pct` values are normalized from percentage strings into decimal probabilities.

Normalized initial market:

- France: `37.272%`
- Draw: `31.837%`
- Spain: `30.893%`

Final replay result:

- France `0`
- Spain `2`
- Finalization event: `game_finalised`, sequence `1026`

## Architecture

- `src/lib/txline`: TxLINE client, environment validation, raw schemas, sample helpers, and normalizers.
- `src/lib/beliefComparison.ts`: deterministic probability comparison.
- `src/lib/replay`: replay timeline validation, projection, controller logic, and receipt construction.
- `test-fixtures/txline`: sanitized committed fixture, odds, and score samples.
- `test-fixtures/replay/france-spain-18237038.json`: bundled deterministic replay.
- `app/page.tsx` and `app/BeliefComparisonClient.tsx`: Next.js route and client UI.

The deployed browser flow uses committed sanitized captures, makes no runtime TxLINE API request, and contains no TxLINE credential. Private credentials are needed only for optional local probe and capture scripts.

## Validation

Core commands:

```bash
npm run replay:validate
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run replay:validate` verifies that the committed replay can load offline, is chronological, respects the market-start boundary, reaches finalization, and has a receipt score matching the observed `game_finalised` event.

The project owner reported successful incognito desktop and mobile-width smoke tests against the production URL on July 16, 2026.

## Limitations

- The demo supports one fixture and one market type.
- Historical odds movement was not available for the completed fixture, so replay uses a fixed initial market snapshot.
- `/api/scores/historical/18237038` and `/api/scores/updates/18237038` returned non-JSON data during capture.
- No proof payload has been identified.
- Local proof validation and on-chain validation were not executed.
- The application is read-only and intentionally excludes wagering, custody, wallets, accounts, databases, extra sports, and extra market types.

## Submission Statement

Match Horizon demonstrates a reusable market-reasoning pattern for sports: translate market data into probabilities, compare it with a user's belief, identify the clearest disagreement, and resolve the view against real captured outcome data. It is intentionally scoped as a reliable public demo rather than a betting product.

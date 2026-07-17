# Technical Submission Summary

Public demo: https://match-horizon.vercel.app

Match Horizon is a Next.js hackathon prototype that translates captured TxLINE World Cup data into a deterministic market-belief comparison, required-edge pricing, fractional Kelly sizing, and simulated execution-routing flow.

## What It Does

The app opens a real France vs Spain World Cup fixture, displays normalized TxLINE three-way match-result probabilities, accepts a user's personal probabilities, calculates the strongest positive disagreement, converts that belief into fair odds and calculated minimum odds, sizes the target with Quarter/Half/Full Kelly or manual sizing, builds a deterministic simulated execution route, replays the completed fixture, and shows a TxLINE-data-backed result receipt beside a separately labeled simulated execution settlement.

The implemented flow is:

```text
Market belief -> personal belief -> fair odds -> required edge -> fractional Kelly or manual target -> simulated route -> deterministic replay -> result receipt + simulated settlement
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

## Simulated Execution Routing

The execution layer is intentionally not TxLINE data. It uses a committed generic liquidity book with simulated venue labels for all three outcomes. A pure pricing module converts the user's probability and required edge into fair odds and calculated minimum odds, then calculates Quarter, Half, or Full Kelly sizing from that minimum odds value. The router validates the execution intent and quote book, filters quotes to the selected strongest positive outcome, excludes quotes below the calculated minimum decimal odds, sorts by best odds first with deterministic tie-breaks, supports partial fills, and calculates filled stake, unfilled stake, weighted-average odds, estimated gross payout, and expected return using the user's probability.

Default Spain example:

- User probability: `50%`
- Fair decimal odds: `2.00`
- Required edge: `10%`
- Calculated minimum odds: `2.20`
- Strategy bankroll: `$120,000`
- Kelly setting: Half Kelly
- Full Kelly: `8.33%`
- Applied Kelly: `4.17%`
- Suggested stake: `$5,000`
- Rejected quote: Venue D at `2.10`, below the `2.20` minimum
- Routed fills: `$500` at `3.50`, `$2,000` at `3.42`, `$2,500` at `3.30`
- Filled stake: `$5,000`
- Weighted-average odds: `3.368`, displayed as `3.37`
- Estimated gross payout: `$16,840`

The deliberately poor Venue D quote makes the minimum-price policy visible: it is excluded before routing, while the full target is filled across the three better venues. Kelly is an educational simulation reference based on the user's probability estimate, not a recommendation, guarantee, or validation of that belief. Manual stake sizing remains available.

The UI prominently states `Simulation only - no wager submitted`. No external betting API, real venue name, account, wallet, custody, AMM, order book, or smart contract is added.

## Architecture

- `src/lib/txline`: TxLINE client, environment validation, raw schemas, sample helpers, and normalizers.
- `src/lib/beliefComparison.ts`: deterministic probability comparison.
- `src/lib/execution`: deterministic required-edge pricing, fractional Kelly sizing, simulated router, generic demo liquidity, and unit tests.
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

The required-edge and Kelly build passed local and production verification before this final demo-liquidity clarification. The quote change preserves the tested route totals and requires the same full validation gate before deployment.

## Limitations

- The demo supports one fixture and one market type.
- Historical odds movement was not available for the completed fixture, so replay uses a fixed initial market snapshot.
- `/api/scores/historical/18237038` and `/api/scores/updates/18237038` returned non-JSON data during capture.
- No proof payload has been identified.
- Local proof validation and on-chain validation were not executed.
- The application is read-only and intentionally excludes wagering, external betting APIs, real venue names, custody, wallets, accounts, databases, smart contracts, AMMs, order books, portfolio Kelly, correlation modeling, extra sports, and extra market types.

## Submission Statement

Match Horizon demonstrates a reusable market-reasoning pattern for sports: translate market data into probabilities, compare it with a user's belief, identify the clearest disagreement, convert the belief into required-edge pricing and sizing references, simulate how an execution agent could route generic liquidity, and resolve the view against real captured outcome data. It is intentionally scoped as a reliable public demo rather than a betting product.

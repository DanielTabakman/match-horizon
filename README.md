# Match Horizon

Match Horizon is a narrow TxLINE-powered World Cup demo for comparing a market's match-result probabilities with a user's own belief, building a simulated execution route for the clearest positive disagreement, then resolving that view through a deterministic replay of a completed fixture.

Public demo: https://match-horizon.vercel.app

Repository: https://github.com/DanielTabakman/match-horizon

Before the required-edge and Kelly extension, the project owner smoke-tested the merged execution-routing deployment in an incognito desktop browser and at mobile width on July 16, 2026. This Issue #24 branch has passed local desktop and mobile-width smoke tests, but it has not yet been merged, deployed to production, or smoke-tested at the public URL.

## Product Flow

The implemented judge flow is:

1. Open the committed World Cup fixture: France vs Spain, fixture `18237038`.
2. Review normalized TxLINE three-way match-result probabilities.
3. Enter personal probabilities for France, Draw, and Spain. The total must be exactly `100%`.
4. See outcome-by-outcome disagreement, calculated as `user probability - market probability`.
5. See the strongest positive disagreement and the plain match-result expression that represents it.
6. Convert the selected belief into fair odds, required edge, calculated minimum odds, and a fractional Kelly sizing reference.
7. Build a simulated execution route against generic venue liquidity using Kelly sizing by default or a manual stake alternative.
8. Review routed fills, weighted-average odds, estimated payout, and user-belief expected return.
9. Start the bundled deterministic replay.
10. Use Start, Pause, Play, Restart, `1x`, and `4x` controls.
11. Watch the replay reach the observed final result: France `0`, Spain `2`.
12. Inspect the real TxLINE result receipt and the separately labeled simulated execution settlement.

The product is read-only. The execution route and Kelly output are deterministic simulation references only: no wager is submitted, no external venue is contacted, and no real sportsbook or exchange name is used. Kelly sizing is based entirely on the user's probability estimate and is not bankroll advice. The app does not custody funds, connect wallets, create accounts, run an order book, or provide bankroll advice.

## Architecture

```text
Committed TxLINE fixture, odds, and score captures
        |
        v
src/lib/txline normalizers and explicit schema checks
        |
        v
Normalized Match Horizon domain types
        |
        +--> belief comparison logic and tests
        |
        +--> deterministic replay timeline and receipt logic
        |
        +--> simulated execution router and generic liquidity book
        |
        v
Next.js app route and React client UI
```

Key boundaries:

- Raw TxLINE payload handling lives under `src/lib/txline`.
- UI components consume normalized `Fixture`, `MarketSnapshot`, `ScoreEvent`, and `ResultReceipt` domain types.
- The deployed judge flow uses committed captures and makes no runtime TxLINE API request.
- Local TxLINE probe and capture scripts are available for maintainers, but they require private environment variables and are not part of the public browser flow.
- Simulated venue liquidity lives under `src/lib/execution` and is not TxLINE data.
- The simulated execution settlement is shown separately from the TxLINE result receipt.

## TxLINE Data Used

Committed replay fixture: `test-fixtures/replay/france-spain-18237038.json`.

Fixture:

- Fixture id: `18237038`
- Participants: France vs Spain
- Start time: `2026-07-14T19:00:00.000Z`
- Fixture metadata capture time: `2026-07-14T18:42:08.439Z`

Initial market:

- Source file: `test-fixtures/txline/odds-snapshot.json`
- Capture time: `2026-07-14T18:42:08.439Z`
- Market type normalized by Match Horizon: full-match three-way result
- Observed TxLINE market identifier: `SuperOddsType = "1X2_PARTICIPANT_RESULT"`
- Observed period/parameters for the supported full-match market: `MarketPeriod = null`, `MarketParameters = null`
- Normalized probabilities:
  - France: `0.37272` or `37.272%`
  - Draw: `0.31837` or `31.837%`
  - Spain: `0.30893` or `30.893%`
- Observed raw probability total: `100.002%`, accepted within the implemented tolerance.

Score and replay:

- Score source endpoint: `/api/scores/snapshot/18237038`
- Score capture time: `2026-07-16T18:02:13.363Z`
- Score records returned: `40`
- Committed playable score events: `32`
- Finalization event: `game_finalised`, sequence `1026`
- Final score read from the finalization event: France `0`, Spain `2`

## Endpoints Attempted

These endpoint findings are committed in the replay file:

| Endpoint | Result | Records | Use |
| --- | --- | ---: | --- |
| `/api/fixtures/snapshot` | records | 7 | Fixture discovery and metadata source |
| `/api/odds/snapshot/18237038` | empty | 0 | Completed-fixture live odds endpoint returned no records during replay capture |
| `/api/scores/historical/18237038` | non-JSON | n/a | Attempted historical score source, not usable in this capture |
| `/api/scores/updates/18237038` | non-JSON | n/a | Attempted score updates source, not usable in this capture |
| `/api/scores/snapshot/18237038` | records | 40 | Replay score source |

## Deterministic Replay

The replay is bundled so the demo works when no live match is available. `npm run replay:validate` loads the committed replay without network access and checks:

- fixture, market, and receipt ids agree;
- replay events are chronological;
- playable events do not predate the initial market snapshot;
- a finalization event exists;
- the finalization payload matches the top-level receipt;
- the receipt final score matches the observed `game_finalised` score totals.

Earlier score-feed records are excluded when they predate the fixed initial market snapshot. Unknown scores stay unknown until an observed score total is present; the UI must not invent `0-0`.

## Fixed Historical Market Limitation

Historical odds movement is not captured for this completed fixture. The replay keeps the real initial TxLINE market snapshot fixed while score and finalization events advance.

This is intentional and documented. The app must not imply that it observed historical price movement after the initial capture.

## Simulated Execution Layer

Issue #24 extends the deterministic execution-routing demo with required-edge pricing and fractional Kelly sizing. The pricing module converts the user's selected outcome probability into fair decimal odds, applies the required expected return to produce calculated minimum odds, and calculates Quarter, Half, or Full Kelly references from that minimum price. The router still validates the selected outcome, target stake, minimum decimal odds, user probability, and simulated quotes. It filters quotes for the strongest positive outcome, excludes quotes below the calculated minimum odds, sorts best odds first with deterministic venue and quote tie-breaks, fills across multiple generic venues, supports partial fills, and calculates filled stake, unfilled stake, weighted-average odds, estimated gross payout, and expected return from the user's belief.

The committed demo liquidity is generic and simulated. It is not a TxLINE payload, not a sportsbook integration, and not an exchange integration.

Default Spain route:

- User probability: `50%`
- Fair decimal odds: `2.00`
- Required edge: `10%`
- Calculated minimum odds: `2.20`
- Strategy bankroll: `$120,000`
- Kelly setting: Half Kelly
- Full Kelly: `8.33%`
- Applied Kelly: `4.17%`
- Suggested stake: `$5,000`
- `$500` at decimal odds `3.50`
- `$2,000` at decimal odds `3.42`
- `$2,500` at decimal odds `3.30`
- Filled stake: `$5,000`
- Weighted-average odds: `3.368`, displayed as `3.37`
- Estimated gross payout: `$16,840`

The `3.24` Spain quote is above the calculated `2.20` minimum and remains eligible, but the default `$5,000` target stake is fully filled at better prices first. Manual sizing remains available by disabling Kelly sizing.

When replay starts, the current pricing policy, sizing policy, simulated route, frozen user belief, and expression are frozen together. Later input edits do not rewrite that frozen plan or the simulated settlement.

## Proof And On-Chain Validation Limitations

The current result receipt is TxLINE-data-backed, not proof-validated and not on-chain validated.

Receipt language is intentionally tiered:

- `TxLINE data received: yes`
- `Proof available: no`
- `Proof structure checked: no`
- `On-chain validated: no`

No proof payload has been identified in the captured data. Local proof validation and on-chain validation were not executed, so the README, UI, demo, and submission materials must not describe the result as cryptographically verified or validated on-chain.

## Setup

Requirements:

- Node.js compatible with the checked-in Next.js and TypeScript dependencies
- npm

Install dependencies:

```bash
npm install
```

Run the local app:

```bash
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Validation Commands

Run the full local gate:

```bash
npm run replay:validate
npm test
npm run typecheck
npm run lint
npm run build
```

Optional TxLINE probe and replay capture commands require private TxLINE environment variables:

```bash
cp .env.example .env.local
npm run txline:probe
npm run txline:capture-replay
```

Do not commit `.env`, `.env.local`, tokens, guest JWTs, request headers, or private logs.

## Security And Credentials

- The deployed judge flow uses committed sanitized data and has no TxLINE API credential.
- Authenticated TxLINE scripts read credentials from local environment variables only.
- `.env` and `.env.*` are ignored, except `.env.example`.
- Captured fixtures are sanitized and should not contain tokens or sensitive headers.
- Match Horizon is isolated from MSOS and Autobuilder for the hackathon. It must not import from, deploy through, configure, or modify either project.

## TxLINE API Feedback

What worked well:

- Fixture snapshot, odds snapshot, and score snapshot categories were enough to build a complete read-only demo flow.
- The score snapshot for fixture `18237038` included an explicit `game_finalised` event and final score totals.
- The odds snapshot contained a usable full-match `1X2_PARTICIPANT_RESULT` record with semantic outcome names.

Friction and gaps:

- Historical odds movement for the completed fixture was not available from the attempted completed-fixture odds endpoint, so the replay uses a fixed initial market snapshot.
- `/api/scores/historical/18237038` and `/api/scores/updates/18237038` returned non-JSON data during capture, which made them unusable for replay construction.
- No proof payload was identified in the captured fixture, odds, or score data. Clear proof-discovery documentation or a stable proof endpoint would make receipt validation easier.
- Fixture status used by the committed fixture capture was numeric and not interpreted; the normalized status remains `unknown` rather than guessing semantics.

## Submission Documents

- `docs/DEMO_SCRIPT.md`
- `docs/TECHNICAL_SUBMISSION_SUMMARY.md`
- `docs/SUBMISSION_CHECKLIST.md`
- `docs/REPLAY_CAPTURE.md`
- `docs/OBSERVED_TXLINE_PHASE2.md`
- `docs/PROJECT_CHARTER.md`

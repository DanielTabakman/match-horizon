# Submission Checklist

Public demo URL: `https://match-horizon.vercel.app`

Repository URL: `https://github.com/DanielTabakman/match-horizon`

Production verification: project owner reported the required-edge and fractional Kelly build deployed and verified on the public URL on July 16, 2026.

Verified source commit: `00bd3816ffd2c3e83e37a9abb091203030bf2cfb`.

Verified production deployment: `https://match-horizon-gfhcjoojg-msos-sportsbeting.vercel.app`, aliased to `https://match-horizon.vercel.app`.

## Product

- [x] Real TxLINE fixture loads from committed sanitized capture: France vs Spain, fixture `18237038`.
- [x] Real TxLINE match-result probabilities load from committed sanitized odds capture.
- [x] Probabilities are normalized from observed TxLINE `Pct` values.
- [x] User belief input requires a `100%` total.
- [x] Disagreement calculation is tested.
- [x] Strongest disagreement is explained.
- [x] Expression recommendation is accurate and modest.
- [x] Simulated Execution Agent panel is implemented.
- [x] Strategy preset defaults to Standard.
- [x] Conservative preset applies `15%` required edge and Quarter Kelly.
- [x] Custom preset allows direct edits to required edge, Kelly fraction, and Kelly/manual sizing.
- [x] Generic simulated liquidity covers all three outcomes.
- [x] Default Spain belief is `50%`.
- [x] Default Spain fair odds are `2.00`.
- [x] Default required edge is `10%`.
- [x] Default calculated minimum odds are `2.20`.
- [x] Default strategy bankroll is `$120,000`.
- [x] Default Kelly selection is Half Kelly.
- [x] Default full Kelly is `8.33%`.
- [x] Default applied Kelly is `4.17%`.
- [x] Default suggested stake is `$5,000`.
- [x] Manual stake sizing remains available.
- [x] Default Spain route fills `$5,000` after the best available prices above the `2.20` minimum.
- [x] Simulated route shows filled stake, unfilled stake, weighted-average odds, payout, and expected value.
- [x] UI states `Simulation only - no wager submitted`.
- [x] UI states Kelly sizing is based on the user's own probability and is not a recommendation.
- [x] Optional paper prediction-market quote is off by default and labeled as manually entered paper data.
- [x] Paper quote uses the existing minimum-odds filter and router when enabled with valid odds and size.
- [x] Prediction-market connections panel states coming soon and does not claim a live venue connection.
- [x] Historical replay reaches final result.
- [x] Result receipt is based on real TxLINE score data.
- [x] Simulated execution settlement is labeled separately from the TxLINE result receipt.
- [x] Replay freezes pricing, sizing, route, and settlement context.
- [x] No live match is required for the core demo.

## Reliability

- [x] Replay validation command exists: `npm run replay:validate`.
- [x] Unit/integration test command exists: `npm test`.
- [x] Typecheck command exists: `npm run typecheck`.
- [x] Lint command exists: `npm run lint`.
- [x] Build command exists: `npm run build`.
- [x] Execution router validation, filtering, sorting, fills, payout, and expected value are tested.
- [x] Required-edge fair odds, minimum odds, expected return, Kelly multipliers, default Spain policy, route invalidation key, paper quote routing/filtering, and frozen replay policy are tested.
- [x] Empty, unsupported-market, and error states are implemented for the committed snapshot loader.
- [x] Local replay validation, tests, typecheck, lint, and build passed before deployment.
- [x] Local desktop smoke test passes for the required-edge and Kelly build.
- [x] Local mobile-width smoke test passes for the required-edge and Kelly build.
- [x] Public production page contains required edge, bankroll, Kelly selector, sizing toggle, `2.20`, `8.33%`, `4.17%`, and `$5,000`.
- [x] Production domain is assigned to the successful local-source deployment.

## Replay Evidence

- [x] Replay fixture is committed at `test-fixtures/replay/france-spain-18237038.json`.
- [x] Replay loads without network access.
- [x] Replay events are deterministic and chronological.
- [x] Unknown scores remain unknown until observed totals appear.
- [x] Replay reaches `game_finalised`, sequence `1026`.
- [x] Final score is France `0`, Spain `2`.
- [x] Fixed historical market limitation is documented.

## TxLINE Data

- [x] `/api/fixtures/snapshot` documented as returning `7` records.
- [x] `/api/odds/snapshot/18237038` documented as returning `0` records during completed-fixture replay capture.
- [x] `/api/scores/historical/18237038` documented as returning non-JSON data during capture.
- [x] `/api/scores/updates/18237038` documented as returning non-JSON data during capture.
- [x] `/api/scores/snapshot/18237038` documented as returning `40` records and serving as replay score source.
- [x] No invented historical odds movement.
- [x] No invented score totals, finalization, proof payloads, or verification results.
- [x] Simulated venue liquidity is documented as separate from real TxLINE data.

## Isolation

- [x] No imports or dependencies from MSOS.
- [x] No imports or dependencies from Autobuilder.
- [x] No MSOS or Autobuilder files were modified by the submission workstream.
- [x] Autobuilder was not used.
- [x] Separate public Vercel deployment URL recorded.

## Security

- [x] No credentials committed in the documentation or release-record workstreams.
- [x] Public judge flow does not require a TxLINE API token.
- [x] `.env*` ignored except `.env.example`.
- [x] README warns not to commit tokens, guest JWTs, headers, or private logs.
- [x] Captured samples are sanitized.
- [ ] Public repository history secret scan or equivalent final review complete.

## Documentation

- [x] README explains problem and implemented product.
- [x] README gives exact user flow.
- [x] README explains architecture.
- [x] README lists specific TxLINE data used.
- [x] README lists attempted endpoints and observed results.
- [x] README explains local setup and validation commands.
- [x] README explains deterministic replay mode.
- [x] README distinguishes TxLINE data, proof availability, proof structure checks, and on-chain validation.
- [x] README distinguishes real TxLINE data from simulated venue liquidity and execution.
- [x] Demo script distinguishes real TxLINE receipt from simulated execution settlement.
- [x] Demo script explains fair odds and minimum acceptable odds.
- [x] Demo script explains required edge, calculated minimum odds, and Half Kelly sizing.
- [x] Demo script no longer claims the `3.24` quote is rejected in the default flow.
- [x] Demo script explains TxLINE versus execution venues and future venue connectors.
- [x] Technical summary distinguishes TxLINE integration from simulated routing.
- [x] Known limitations documented.
- [x] TxLINE feedback drafted.
- [x] Under-five-minute demo script created.
- [x] Technical submission summary created.
- [x] License present.

## Deployment

- [x] Required-edge and Kelly build is merged.
- [x] Required-edge and Kelly build is deployed to the public URL.
- [x] Public URL exposes the required-edge and Kelly controls.
- [x] Default public values show `2.20`, `8.33%`, `4.17%`, and `$5,000`.
- [x] Captured replay is bundled in the deployed build.
- [x] No TxLINE credential is required for the public judge flow.
- [x] No development-only local paths are visible in the deployed product.
- [x] README and submission documents record the production URL.

## Demo Video

- [ ] Under five minutes.
- [ ] States the problem in under 20 seconds.
- [ ] Shows real TxLINE-powered market data.
- [ ] Shows user belief entry.
- [ ] Explains fair odds.
- [ ] Shows disagreement result.
- [ ] Explains required edge and calculated minimum odds.
- [ ] Shows Half Kelly sizing and the manual alternative.
- [ ] Explains simulated venues versus TxLINE.
- [ ] Shows simulated route build.
- [ ] Shows replay controls.
- [ ] Shows final receipt.
- [ ] Shows separate simulated settlement.
- [ ] Explains architecture briefly.
- [ ] Mentions deterministic replay because matches may not be live.
- [ ] States fixed historical market limitation.
- [ ] States proof and on-chain validation limitations.
- [ ] Ends with deployed URL and repository.

## Submission Form

- [ ] Demo video link.
- [ ] Public repository link entered.
- [ ] Working application link entered.
- [ ] Short product description entered.
- [ ] Technical overview entered.
- [ ] TxLINE endpoints or data categories entered.
- [ ] Business or future-use explanation entered.
- [ ] TxLINE positive feedback entered.
- [ ] TxLINE friction or bug feedback entered.
- [ ] Team and eligibility information entered.

## Final Gate

- [x] Public required-edge and Kelly application opens in a browser.
- [x] Public required-edge and Kelly values are present on the production domain.
- [x] Local desktop and mobile smoke tests passed.
- [x] Local deterministic replay completes and restarts correctly.
- [x] README records the final Vercel URL.
- [x] Submission checklist records the final Vercel URL.
- [ ] Demo video URL recorded.
- [ ] Repository-history secret review completed.
- [ ] Final submission form sent before the deadline.
- [x] Current verification claims are supported by implemented or owner-reported evidence.

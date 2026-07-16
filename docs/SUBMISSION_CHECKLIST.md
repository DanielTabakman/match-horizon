# Submission Checklist

Public demo URL: `https://match-horizon.vercel.app`

Repository URL: `https://github.com/DanielTabakman/match-horizon`

Production verification: project owner reported the merged execution-routing deployment working on the public URL at desktop and mobile width on July 16, 2026.

## Product

- [x] Real TxLINE fixture loads from committed sanitized capture: France vs Spain, fixture `18237038`.
- [x] Real TxLINE match-result probabilities load from committed sanitized odds capture.
- [x] Probabilities are normalized from observed TxLINE `Pct` values.
- [x] User belief input requires a `100%` total.
- [x] Disagreement calculation is tested.
- [x] Strongest disagreement is explained.
- [x] Expression recommendation is accurate and modest.
- [x] Simulated Execution Agent panel is implemented.
- [x] Generic simulated liquidity covers all three outcomes.
- [x] Default Spain route fills `$5,000` at minimum decimal odds `3.30`.
- [x] Simulated route shows filled stake, unfilled stake, weighted-average odds, payout, and expected value.
- [x] UI states `Simulation only - no wager submitted`.
- [x] Historical replay reaches final result.
- [x] Result receipt is based on real TxLINE score data.
- [x] Simulated execution settlement is labeled separately from the TxLINE result receipt.
- [x] No live match is required for the core demo.

## Reliability

- [x] Replay validation command exists: `npm run replay:validate`.
- [x] Unit/integration test command exists: `npm test`.
- [x] Typecheck command exists: `npm run typecheck`.
- [x] Lint command exists: `npm run lint`.
- [x] Build command exists: `npm run build`.
- [x] Execution router validation, filtering, sorting, fills, payout, and expected value are tested.
- [x] Empty, unsupported-market, and error states are implemented for the committed snapshot loader.
- [x] Local replay validation, tests, typecheck, lint, and build passed before deployment.
- [x] Local desktop smoke test passes for the execution-routing branch.
- [x] Local mobile-width smoke test passes for the execution-routing branch.
- [x] Execution-routing browser smoke test passes on the public URL.
- [x] Execution-routing mobile-width smoke test passes on the public URL.

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
- [x] Demo script explains TxLINE versus execution venues and future venue connectors.
- [x] Technical summary distinguishes TxLINE integration from simulated routing.
- [x] Known limitations documented.
- [x] TxLINE feedback drafted.
- [x] Under-five-minute demo script created.
- [x] Technical submission summary created.
- [x] License present.

## Deployment

- [x] Execution-routing build is merged and deployed to the public URL.
- [x] Public URL works with the execution-routing UI.
- [x] Default route leads to the execution-routing demo.
- [x] Captured replay is bundled in the deployed execution-routing build.
- [x] No TxLINE credential is required for the public execution-routing judge flow.
- [x] No development-only local paths are visible in the deployed execution-routing product.
- [x] README and submission documents record the production URL.

## Demo Video

- [ ] Under five minutes.
- [ ] States the problem in under 20 seconds.
- [ ] Shows real TxLINE-powered market data.
- [ ] Shows user belief entry.
- [ ] Explains fair odds.
- [ ] Shows disagreement result.
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

- [x] Public execution-routing application opens in a browser.
- [x] Public execution-routing desktop smoke test passes.
- [x] Public execution-routing mobile-width smoke test passes.
- [x] Local execution-routing deterministic replay completes and restarts correctly.
- [x] Public execution-routing deterministic replay completes and restarts correctly.
- [x] README records the final Vercel URL.
- [x] Submission checklist records the final Vercel URL.
- [ ] Demo video URL recorded.
- [ ] Repository-history secret review completed.
- [ ] Final submission form sent before the deadline.
- [x] Current verification claims are supported by implemented or owner-reported evidence.

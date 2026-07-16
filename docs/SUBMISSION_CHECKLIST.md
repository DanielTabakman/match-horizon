# Submission Checklist

Public demo URL: **PUBLIC_VERCEL_URL_PLACEHOLDER - replace after deployment smoke tests pass**

Repository URL: `https://github.com/DanielTabakman/match-horizon`

## Product

- [x] Real TxLINE fixture loads from committed sanitized capture: France vs Spain, fixture `18237038`.
- [x] Real TxLINE match-result probabilities load from committed sanitized odds capture.
- [x] Probabilities are normalized from observed TxLINE `Pct` values.
- [x] User belief input requires a `100%` total.
- [x] Disagreement calculation is tested.
- [x] Strongest disagreement is explained.
- [x] Expression recommendation is accurate and modest.
- [x] Historical replay reaches final result.
- [x] Result receipt is based on real TxLINE score data.
- [x] No live match is required for the core demo.

## Reliability

- [x] Replay validation command exists: `npm run replay:validate`.
- [x] Unit/integration test command exists: `npm test`.
- [x] Typecheck command exists: `npm run typecheck`.
- [x] Lint command exists: `npm run lint`.
- [x] Build command exists: `npm run build`.
- [x] Empty, unsupported-market, and error states are implemented for the committed snapshot loader.
- [x] Current branch checks run and passing for this documentation PR.
- [ ] Incognito browser smoke test passes on the public URL.
- [ ] Mobile-width smoke test passes on the public URL.

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

## Isolation

- [x] No imports or dependencies from MSOS.
- [x] No imports or dependencies from Autobuilder.
- [x] No MSOS or Autobuilder files were modified by this documentation workstream.
- [x] Autobuilder was not used.
- [ ] Separate public Vercel deployment URL recorded after Daniel provides it.

## Security

- [x] No credentials committed in this documentation workstream.
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
- [x] Known limitations documented.
- [x] TxLINE feedback drafted.
- [x] Under-five-minute demo script created.
- [x] Technical submission summary created.
- [x] License present.

## Deployment

- [ ] Public URL works.
- [ ] Default route leads to the demo.
- [ ] Captured replay bundled in deployed build.
- [ ] No TxLINE credential required for public judge flow.
- [ ] No development-only paths visible in the product.
- [ ] No broken submission-document links.

## Demo Video

- [ ] Under five minutes.
- [ ] States the problem in under 20 seconds.
- [ ] Shows real TxLINE-powered market data.
- [ ] Shows user belief entry.
- [ ] Shows disagreement result.
- [ ] Shows replay controls.
- [ ] Shows final receipt.
- [ ] Explains architecture briefly.
- [ ] Mentions deterministic replay because matches may not be live.
- [ ] States fixed historical market limitation.
- [ ] States proof and on-chain validation limitations.
- [ ] Ends with deployed URL and repository.

## Submission Form

- [ ] Demo video link.
- [ ] Public repository link.
- [ ] Working application link.
- [ ] Short product description.
- [ ] Technical overview.
- [ ] TxLINE endpoints or data categories used.
- [ ] Business or future-use explanation.
- [ ] TxLINE positive feedback.
- [ ] TxLINE friction or bug feedback.
- [ ] Team and eligibility information.

## Final Gate

- [ ] Public application opens in an incognito browser.
- [ ] Desktop smoke test passes.
- [ ] Mobile-width smoke test passes.
- [ ] Deterministic replay completes and restarts correctly.
- [ ] README public URL placeholder replaced with the final Vercel URL.
- [ ] Submission checklist public URL placeholder replaced with the final Vercel URL.
- [ ] Demo video URL recorded.
- [ ] Every verification claim is supported by implemented evidence.

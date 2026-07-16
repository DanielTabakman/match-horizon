# Current Task

**Status:** ISSUE #24 REQUIRED EDGE + FRACTIONAL KELLY PRIMARY — FINAL SUBMISSION AFTER MERGE

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#16 — Submission documentation](https://github.com/DanielTabakman/match-horizon/pull/16) is merged.
- [#17 — Public release records](https://github.com/DanielTabakman/match-horizon/pull/17) is merged.
- [#20 — Simulated execution routing demo](https://github.com/DanielTabakman/match-horizon/pull/20) is merged and deployed.
- [#18 — Simulated execution routing](https://github.com/DanielTabakman/match-horizon/issues/18) is complete.

**Active implementation issue:** [#24 — Add required-edge and fractional Kelly sizing](https://github.com/DanielTabakman/match-horizon/issues/24)

**Submission issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5) remains open and resumes immediately after Issue #24 is merged, deployed, and smoke-tested.

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

**Public demo:** https://match-horizon.vercel.app

## Authorized product flow

**TxLINE market → Personal belief → Fair odds → Required edge → Calculated minimum odds → Fractional Kelly target stake → Simulated liquidity routing → Deterministic replay → Result and simulated settlement receipts**

Issue #24 is an explicitly authorized final product slice. It overrides the previous no-new-scope submission instruction only for the narrow work defined in that issue.

## Primary implementation result

1. Add pure deterministic pricing and sizing functions under `src/lib/execution/`.
2. Convert user probability and required expected edge into calculated minimum decimal odds.
3. Calculate Quarter, Half, and Full Kelly references using the calculated minimum odds.
4. Default Spain demo values must produce:
   - user probability `50%`;
   - fair odds `2.00`;
   - required edge `10%`;
   - calculated minimum odds `2.20`;
   - strategy bankroll `$120,000`;
   - full Kelly `8.33%`;
   - applied Half Kelly `4.17%`;
   - suggested stake `$5,000`.
5. Preserve manual stake sizing as a working alternative.
6. Route the selected target stake through the existing deterministic simulated liquidity book.
7. Preserve the existing default fills at `3.50`, `3.42`, and `3.30`, weighted odds `3.37`, and gross payout `$16,840`.
8. Freeze pricing, sizing, route, and settlement context when replay starts.
9. Keep the TxLINE result receipt separate from simulated execution settlement.
10. Update README, demo script, technical summary, checklist, and production evidence accurately.

## Truth and safety boundary

- Simulation only; no wager submitted.
- Venue quotes and liquidity remain simulated.
- Kelly is an educational sizing reference based entirely on the user's probability estimate.
- Kelly does not validate the belief, guarantee returns, or constitute bankroll advice.
- No real venue integration, wallet, custody, account, database, or smart contract.
- No portfolio Kelly, correlation model, or simultaneous-position optimization.
- No MSOS or Autobuilder dependency.

## Required checks

- `npm run replay:validate`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Local desktop and mobile-width smoke tests
- Production desktop and mobile-width smoke tests after merge/deployment

## Coordination

- Use worktree `C:\Users\USER\match-horizon-edge-kelly`.
- Use branch `codex/issue-24-edge-kelly`.
- Open a draft PR after the pure pricing/Kelly module and tests form the first coherent slice.
- Draft PR #23 overlaps README and demo-script wording. Do not merge it before Issue #24. Reconcile or supersede it after the product implementation is stable.

## After Issue #24

1. Confirm production deployment and public smoke tests.
2. Freeze product scope.
3. Practice and record the under-five-minute demo.
4. Complete the repository-history secret review.
5. Complete and submit the hackathon form.
6. Close Issue #5 only after submission is confirmed.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

# Current Task

**Status:** PRODUCT COMPLETE AND DEPLOYED — REHEARSAL, VIDEO, SECRET REVIEW, AND SUBMISSION PRIMARY

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#16 — Submission documentation](https://github.com/DanielTabakman/match-horizon/pull/16) is merged.
- [#17 — Public release records](https://github.com/DanielTabakman/match-horizon/pull/17) is merged.
- [#20 — Simulated execution routing demo](https://github.com/DanielTabakman/match-horizon/pull/20) is merged.
- [#26 — Required-edge and fractional Kelly sizing](https://github.com/DanielTabakman/match-horizon/pull/26) is merged.
- [#18 — Simulated execution routing](https://github.com/DanielTabakman/match-horizon/issues/18) is complete.
- [#24 — Required-edge and fractional Kelly sizing](https://github.com/DanielTabakman/match-horizon/issues/24) is complete.

**Active issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5)

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

**Public demo:** https://match-horizon.vercel.app

## Verified production state

On July 16, 2026, the project owner deployed source commit `00bd3816ffd2c3e83e37a9abb091203030bf2cfb` directly from the clean `match-horizon-edge-kelly` worktree to the existing Vercel production project after GitHub automatic deployments failed.

Verified production deployment:

- deployment URL: `https://match-horizon-gfhcjoojg-msos-sportsbeting.vercel.app`;
- production alias: `https://match-horizon.vercel.app`;
- Vercel build state: Ready;
- production page contains `Required edge (%)`, `Strategy bankroll`, `Kelly fraction`, and `Use Kelly sizing`;
- default values include minimum odds `2.20`, full Kelly `8.33%`, applied Half Kelly `4.17%`, and suggested stake `$5,000`.

## Final product flow

**TxLINE market → Personal belief → Fair odds → Required edge → Calculated minimum odds → Fractional Kelly target stake → Simulated liquidity routing → Deterministic replay → Result and simulated settlement receipts**

Default demo values:

- Spain belief `50%`;
- fair odds `2.00`;
- required edge `10%`;
- calculated minimum odds `2.20`;
- strategy bankroll `$120,000`;
- full Kelly `8.33%`;
- applied Half Kelly `4.17%`;
- suggested stake `$5,000`;
- fills at Matchbook `3.25`, Pinnacle `3.23`, and William Hill `3.00`;
- weighted odds `3.12`;
- gross payout `$15,585`.

## Truth and safety boundary

- Simulation only; no wager submitted.
- TxLINE supplies the captured market reference and match result.
- Venue names, executable quotes, liquidity, order submission, and settlement are simulated.
- Kelly is an educational sizing reference based entirely on the user's probability estimate.
- Kelly does not validate the belief, guarantee returns, or constitute bankroll advice.
- No real venue integration, wallet, custody, account, database, or smart contract.
- No proof payload was identified and no on-chain validation was executed.
- No MSOS or Autobuilder dependency.

## Immediate priority

1. Do one timed rehearsal using `docs/DEMO_SCRIPT.md`.
2. Fix only presentation-blocking problems; product scope is frozen.
3. Record and upload the under-five-minute demo video.
4. Record the video URL in the README or submission checklist.
5. Complete the public repository-history secret scan or equivalent review.
6. Fill every submission-form field.
7. Submit before the deadline.
8. Close Issue #5 only after submission is confirmed.

## Final production smoke flow

Before recording, confirm:

1. the public URL opens without authentication;
2. France vs Spain and captured TxLINE probabilities appear;
3. Spain is the strongest disagreement at a `25 / 25 / 50` belief;
4. fair odds display `2.00`;
5. required edge displays `10%` and minimum odds display `2.20`;
6. Half Kelly displays `8.33%` full, `4.17%` applied, and `$5,000` suggested stake;
7. the default route fills at Matchbook `3.25`, Pinnacle `3.23`, and William Hill `3.00` with weighted odds `3.12` and payout `$15,585`;
8. manual sizing appears when `Use Kelly sizing` is disabled;
9. replay freezes the pricing, sizing, and route policy and reaches France `0`, Spain `2`;
10. the TxLINE receipt retains exact proof and validation limits;
11. the simulated settlement remains visibly separate;
12. desktop and mobile layouts remain usable.

## Hard stops

- No more product features before submission.
- No actual wagering or order submission.
- No real sportsbook or exchange names unless an integration is explicitly verified.
- No implied venue partnerships.
- No wallet, custody, escrow, account, database, smart-contract, AMM, or order-book implementation.
- No portfolio Kelly, correlation model, or simultaneous-position optimization.
- No new live TxLINE dependency in the public judge flow.
- Do not claim proof validation, cryptographic verification, or on-chain validation.
- No broad redesign or unrelated refactor.
- No MSOS or Autobuilder dependency during the hackathon.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and preserve unrelated worktrees.

# Current Task

**Status:** EXECUTION ROUTING DEPLOYED — PRACTICE, VIDEO, SECRET REVIEW, AND SUBMISSION PRIMARY

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#16 — Submission documentation](https://github.com/DanielTabakman/match-horizon/pull/16) is merged.
- [#17 — Public release records](https://github.com/DanielTabakman/match-horizon/pull/17) is merged.
- [#20 — Simulated execution routing demo](https://github.com/DanielTabakman/match-horizon/pull/20) is merged.
- [#4 — Historical replay](https://github.com/DanielTabakman/match-horizon/issues/4) is complete.
- [#18 — Simulated execution routing](https://github.com/DanielTabakman/match-horizon/issues/18) is complete.

**Active issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5)

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

**Public demo:** https://match-horizon.vercel.app

The project owner confirmed on July 16, 2026 that the production execution-routing flow appears to work after PR #20 deployed. The public app shows the Execution Agent, builds the simulated route, completes deterministic replay, and displays the separate TxLINE result and simulated settlement receipts.

## Final product flow

**TxLINE market → Personal belief → Disagreement → Selected outcome → Simulated liquidity routing → Deterministic replay → Result and simulated settlement receipts**

## Truth boundary

**Real committed TxLINE data:**

- fixture and participants;
- initial three-way market probabilities;
- score events;
- `game_finalised` event;
- France 0–Spain 2 final result.

**Simulated demo layer:**

- external venue identities;
- venue odds and available liquidity;
- order routing and submission;
- execution and profit/loss receipts.

The routing calculations are real, deterministic, and tested. The UI must continue to state **Simulation only — no wager submitted** and must not imply live sportsbook integrations or partnerships.

## Immediate priority

1. Practice the live stage presentation using `docs/DEMO_SCRIPT.md` as source material, adapted around the belief-to-execution product story.
2. Record and upload the under-five-minute submission video.
3. Record the final video URL in the README or submission checklist.
4. Complete the repository-history secret scan or equivalent final review.
5. Complete every required submission-form field.
6. Submit before the deadline.
7. Close Issue #5 only after submission is confirmed.

## Final production smoke flow

Before recording or presenting, confirm:

1. the public URL opens without authentication;
2. France vs Spain and the captured TxLINE probabilities appear;
3. a valid belief can make Spain the strongest disagreement;
4. the Execution Agent states `Simulation only - no wager submitted`;
5. `$5,000` at minimum odds `3.30` builds the expected multi-venue route;
6. weighted-average odds display `3.37` and gross payout displays `$16,840`;
7. replay freezes the route and reaches France 0–Spain 2;
8. the TxLINE receipt retains the exact proof and validation limits;
9. the simulated settlement remains visibly separate;
10. desktop and mobile layouts remain usable.

## Hard stops

- Do not add more product scope before submission.
- No actual wagering or order submission.
- No real sportsbook or exchange names unless a future integration is explicitly authorized and verified.
- No implied venue partnerships.
- No wallet, custody, escrow, account, database, smart-contract, AMM, or order-book implementation before submission.
- No new live TxLINE dependency in the public judge flow.
- Do not claim proof validation, cryptographic verification, or on-chain validation.
- No broad redesign or unrelated refactor.
- No MSOS or Autobuilder dependency during the hackathon.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

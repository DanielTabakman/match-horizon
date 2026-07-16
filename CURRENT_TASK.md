# Current Task

**Status:** ISSUE #18 EXECUTION ROUTING DEMO PRIMARY — VIDEO AFTER MERGE

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#16 — Submission documentation](https://github.com/DanielTabakman/match-horizon/pull/16) is merged.
- [#17 — Public release records](https://github.com/DanielTabakman/match-horizon/pull/17) is merged.
- [#4 — Historical replay](https://github.com/DanielTabakman/match-horizon/issues/4) is complete.

**Active implementation issue:** [#18 — Add simulated execution routing demo](https://github.com/DanielTabakman/match-horizon/issues/18)

**Submission issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5) remains open and resumes immediately after Issue #18 is merged and deployed.

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

**Current public demo:** https://match-horizon.vercel.app

The project owner reported successful production smoke tests in an incognito desktop browser and at mobile width on July 16, 2026. Preserve that working flow while extending the product story.

## Product direction

The demo now presents Match Horizon as a belief-to-execution agent:

**TxLINE market → Personal belief → Disagreement → Selected outcome → Simulated liquidity routing → Deterministic replay → Result and simulated settlement receipts**

The user states what they believe and how strongly they believe it. Match Horizon uses TxLINE as the normalized market reference, identifies the clearest supported expression, constructs the best deterministic route through available simulated liquidity, and resolves that simulated position against the existing real captured TxLINE result.

## Truth boundary

The distinction between real and simulated evidence must be impossible to miss:

**Real committed TxLINE data:**

- fixture and participants;
- initial three-way market probabilities;
- score events;
- `game_finalised` event;
- France 0–Spain 2 final result.

**Simulated demo layer:**

- external venue names;
- venue odds and available liquidity;
- order routing;
- order submission;
- execution and profit/loss receipts.

The routing calculations themselves must be real, deterministic, and tested. The UI must say **Simulation only — no wager submitted** and must not imply live sportsbook integrations or partnerships.

## Primary workstream — Issue #18

Implement the smallest coherent execution-routing extension described in Issue #18.

Required result:

1. A pure deterministic TypeScript router validates an order intent, filters quotes by selected outcome and minimum decimal odds, sorts best price first, supports partial fills, and calculates weighted-average odds, payout, and user-belief expected value.
2. A committed generic simulated liquidity book supports all three existing outcomes.
3. The default Spain stage example routes `$5,000` at minimum odds `3.30` across multiple simulated venues.
4. An **Execution Agent** panel appears after the strongest-expression section and before replay.
5. The panel follows the current strongest positive disagreement, accepts requested stake and minimum odds, and displays the actual deterministic route.
6. Starting replay freezes the current route alongside the existing belief/expression snapshot.
7. Finalization displays the existing real TxLINE result receipt plus a separately labeled simulated execution settlement.
8. The existing deterministic replay, restart behavior, receipt wording, and mobile usability remain intact.

## Owned implementation paths

Prefer the narrowest changes necessary. Expected ownership includes:

- `src/lib/execution/**`
- `app/BeliefComparisonClient.tsx`
- `app/globals.css`
- execution-router tests
- `README.md`
- `docs/DEMO_SCRIPT.md`
- `docs/TECHNICAL_SUBMISSION_SUMMARY.md`
- `docs/SUBMISSION_CHECKLIST.md`

Do not refactor unrelated belief, TxLINE, or replay code.

## Required checks

- `npm run replay:validate`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

After deployment, repeat the incognito desktop and mobile-width smoke tests, including the new execution route and simulated settlement.

## Hard stops

- No actual wagering or order submission.
- No real sportsbook or exchange names.
- No implied venue integrations or partnerships.
- No wallet, custody, escrow, account, database, smart-contract, AMM, or order-book implementation.
- No live TxLINE dependency in the public judge flow.
- No claims of proof validation, cryptographic verification, or on-chain validation.
- No broad redesign or unrelated refactor.
- No MSOS or Autobuilder dependency during the hackathon.
- Do not replace real calculations with hard-coded route totals.

## Acceptance gate

- Default Spain demo fully fills `$5,000` at minimum decimal odds `3.30` across multiple simulated venues.
- The displayed weighted-average odds and payout are generated by tested routing code.
- Below-minimum quotes are excluded and insufficient liquidity produces a visible partial fill.
- Simulation boundaries are prominent.
- Replay still reaches France 0–Spain 2 and restarts deterministically.
- Final UI shows both the real TxLINE result receipt and simulated execution settlement.
- Existing receipt still says `TxLINE data received: yes`, `Proof available: no`, `Proof structure checked: no`, and `On-chain validated: no`.
- Desktop and mobile-width smoke tests pass.
- All required checks pass.

## After Issue #18

1. Confirm the production deployment updated correctly.
2. Rewrite and practice the live stage demo around belief-to-execution.
3. Record the under-five-minute submission video.
4. Complete the repository-history secret review.
5. Fill and submit the hackathon form.
6. Close Issue #5 only after submission is confirmed.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

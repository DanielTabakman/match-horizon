# Current Task

**Status:** ISSUE #3 MERGED — ISSUE #4 REPLAY FOUNDATION MERGED — REPLAY UI PRIMARY

**Completed foundations:**

- [#10 — Build Issue #3 belief comparison slice](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Add deterministic replay capture foundation](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.

**Active issue:** [#4 — Capture and play one deterministic historical match replay](https://github.com/DanielTabakman/match-horizon/issues/4)

**Dependency state:** The belief-comparison page and deterministic offline replay are both stable on `main`. One integration worker now owns replay UI and result-receipt integration.

## Primary workstream — replay UI integration

Begin from current `main` in a clean worktree and extend the merged Issue #3 page using only the committed replay `test-fixtures/replay/france-spain-18237038.json`.

Implement the smallest coherent end-to-end flow:

1. The user enters a valid three-way belief totaling 100%.
2. Starting the replay freezes an evaluation snapshot containing the user's probabilities, initial market, strongest positive disagreement, and selected match-result expression.
3. Replay controls provide play, pause, restart, and at least one accelerated speed.
4. Playback is deterministic and uses the committed event ordering; restarting produces the same state sequence.
5. Score display changes only when a replay event contains observed score totals. Never initialize, reset, or fill an unknown score with an invented zero.
6. Show a concise recent-event timeline. Do not expose raw TxLINE payload structures in the UI.
7. Historical odds remain fixed at the real initial market snapshot. State plainly that no historical odds movement was available; do not animate or imply market movement.
8. On finalization, settle the selected three-way expression deterministically from the real final score and show whether it occurred.
9. Show a concise result receipt with:
   - fixture and final score;
   - original user probabilities;
   - initial TxLINE market probabilities;
   - selected expression and outcome;
   - `TxLINE data received`;
   - `Proof available: no`;
   - `Proof structure checked: no`;
   - `On-chain validated: no`.

## Engineering requirements

- Keep replay/controller and expression-settlement logic pure where practical and add unit tests.
- Preserve the existing normalized domain boundary; UI must not consume raw TxLINE schemas.
- Preserve the Issue #3 belief editor, disagreement table, error states, accessibility, deterministic UTC formatting, and mobile behavior.
- Use a separate component or clearly bounded integration structure rather than turning the page into an untestable monolith.
- Open a draft PR once play/pause/restart drives the committed replay and the score/event state is visible. Do not wait for final styling.

## Acceptance gate

A judge can locally complete this exact flow without network access:

**Market belief → Personal belief → Disagreement → Expression → Deterministic replay → Final result receipt**

The replay restarts deterministically, preserves unknown scores as unknown, reaches the real France 0–Spain 2 final result, settles the frozen expression correctly, and uses precise verification language.

Required checks:

- `npm run replay:validate`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Hard stops

- Do not capture new data unless a demonstrated defect makes the committed replay unusable.
- Do not add historical odds movement; it was not observed.
- Do not add live-network dependency to the judge flow.
- Do not claim proof validation or on-chain validation.
- Do not add wagering, wallets, databases, accounts, AI analysis, extra sports, or extra market types.
- Do not use, modify, configure, deploy through, or depend on MSOS or Autobuilder.
- Do not begin broad visual redesign, architecture refactoring, or submission polish inside this task.

## Next workstream after this gate

Deployment and Issue #5 submission packaging: public app, receipt polish, README, demo script, video, and final submission.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

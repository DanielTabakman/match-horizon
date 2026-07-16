# Current Task

**Status:** ISSUE #3 MERGED — ISSUE #4 CAPTURE CORRECTIONS PRIMARY

**Completed foundation:** [#10 — Build Issue #3 belief comparison slice](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.

**Active issue:** [#4 — Capture and play one deterministic historical match replay](https://github.com/DanielTabakman/match-horizon/issues/4)

**Active pull request:** [#11 — Add deterministic replay capture foundation](https://github.com/DanielTabakman/match-horizon/pull/11)

**Dependency state:** The core belief-comparison page is now stable on `main`. Replay UI integration remains blocked until PR #11 passes the capture-and-validation gate.

## Primary workstream — finish PR #11

Preserve the real France vs Spain fixture `18237038`, the fixed real initial TxLINE market snapshot, the observed score amendment sequence, and the final `game_finalised` result France 0–Spain 2.

Correct only the outstanding data-integrity findings:

1. Missing nested score totals remain `null`; never convert missing TxLINE fields into zero.
2. `locallyValidated` remains false unless an actual proof payload is structurally validated. Offline replay consistency is a separate claim.
3. The playable replay begins no earlier than `initialMarket.capturedAt`.
4. The synthetic finalization event payload must exactly match the top-level result receipt.

Required checks before final review:

- `npm run replay:validate`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Capture acceptance gate

One versioned replay file:

- loads without network access;
- starts from a valid real market state;
- has stable chronological ordering;
- preserves unknown score values as unknown;
- reaches an explicit real final result;
- distinguishes TxLINE data receipt, replay consistency, proof availability, local proof validation, and on-chain validation accurately.

Historical odds movement remains optional. When unavailable, keep the real initial market snapshot fixed and document the limitation.

## Next workstream — replay UI integration

Do not begin until PR #11 is reviewed and merged.

Once assigned, replay UI may extend the merged Issue #3 page with:

- play, pause, restart, and accelerated playback;
- score updates based on the committed replay;
- a concise event timeline;
- recalculation of the user's original disagreement;
- finalized result state;
- a concise result receipt.

The replay UI worker owns the integration paths only after explicit assignment. Avoid competing writers on the core page.

## Hard stops

- Do not use, modify, configure, deploy through, or depend on MSOS or Autobuilder.
- Do not share environment files, credentials, workspaces, or local-path dependencies with other repositories.
- Do not invent TxLINE records, score totals, finalization, proof status, or historical odds movement.
- Do not claim local proof validation or on-chain validation unless actually executed.
- Do not add wagering, wallets, databases, AI analysis, additional sports, or additional market types.
- Do not begin broad deployment or submission polish before the replay foundation is credible.

## Immediate coordination priority

1. Correct and re-review PR #11.
2. Merge the replay capture foundation.
3. Assign replay UI and result receipt integration.
4. Deploy the stable combined slice.
5. Finish README, demo script, video, and submission package.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.
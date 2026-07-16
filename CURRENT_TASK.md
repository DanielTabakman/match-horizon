# Current Task

**Status:** ISSUE #2 MERGED — ISSUE #3 PRIMARY / ISSUE #4 CAPTURE PARALLEL

**Primary issue:** [#3 — Build the market-belief comparison vertical slice](https://github.com/DanielTabakman/match-horizon/issues/3)

**Approved parallel issue:** [#4 — Capture and play one deterministic historical match replay](https://github.com/DanielTabakman/match-horizon/issues/4), limited initially to capture and validation work.

**Dependency state:** PR #7 is merged. Both workstreams must begin from or update onto current `main`.

## Primary workstream — Issue #3

Issue #3 owns:

- the core page;
- fixture and market probability display;
- the user belief editor;
- 100% probability validation;
- deterministic disagreement logic and tests;
- strongest-disagreement presentation;
- the plain-language match-result expression;
- loading, empty, unsupported-market, and error states;
- core UI styling.

### First durable milestone

Push a branch and open a draft PR as soon as a user can load the committed real fixture and market snapshot, enter a valid belief, and see the calculated disagreements. Do not wait for visual polish.

### Acceptance gate

A user can complete the full belief-comparison flow locally using the real normalized TxLINE fixture and market snapshot. Typecheck, lint, tests, and build pass.

## Parallel workstream — Issue #4 capture and validation only

Issue #4 initially owns:

- completed-fixture discovery and capture scripts;
- sanitized replay fixtures;
- real final-score evidence;
- historical score-event capture;
- historical odds capture where available;
- replay-domain types;
- deterministic timeline utilities;
- replay validation commands;
- tests and replay documentation.

Issue #4 must not edit or redesign the core page while Issue #3 owns it. Replay UI integration begins only after the Issue #3 page structure is stable and ownership is explicitly reassigned.

### First durable milestone

Push a branch and open a draft PR as soon as useful capture scripts, sanitized real data, validators, or concrete endpoint findings exist. Do not wait for the full replay UI.

### Acceptance gate for the capture foundation

One versioned replay file loads without network access, has stable chronological ordering, and reaches an explicit final result using only real captured TxLINE data. If historical odds are unavailable, keep the real initial captured odds snapshot fixed and document the limitation.

## Stalled-session recovery

Every existing or new Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md`.

Before continuing a previously stalled session, require it to report:

1. current branch;
2. current commit SHA;
3. `git status -sb`;
4. files changed;
5. commands run and results;
6. the exact blocker;
7. whether useful work can be committed and pushed now;
8. the smallest next action.

Make one recovery attempt. Preserve useful branches and commits, but replace conversations that cannot expose concrete repository state or a narrow evidenced blocker.

## Hard stops

- Do not use, modify, configure, deploy through, or depend on MSOS or Autobuilder.
- Do not share environment files, credentials, workspaces, or local-path dependencies with other repositories.
- Do not invent TxLINE records, score totals, finalization, proof status, or historical odds movement.
- Do not add wagering, wallets, databases, AI analysis, additional sports, or additional market types.
- Do not allow Issue #3 and Issue #4 workers to edit the same files concurrently.
- Do not begin broad deployment or submission polish before the Issue #3 vertical slice is stable enough to preserve.

## Immediate coordination priority

1. Obtain a GitHub-visible draft PR for Issue #3.
2. Obtain a separate GitHub-visible draft PR for Issue #4 capture and validation.
3. Review Issue #3 first.
4. Review the replay data for real final-score evidence and deterministic offline behavior.
5. Assign replay UI integration only after both foundations are credible.

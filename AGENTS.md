# AGENTS.md — Match Horizon

This repository is a narrow hackathon build. The repository itself is the instruction source; Daniel should not need to paste long task prompts into Codex.

## Start-of-session protocol

Before modifying code:

1. Read `CURRENT_TASK.md`.
2. Read the active GitHub issue linked from that file, using `gh issue view` when available.
3. Read the project documents referenced by the task or issue.
4. Read `docs/EXECUTION_RECOVERY_PROTOCOL.md`.
5. Inspect `git status -sb` and preserve unrelated work.
6. Work only on the active task and stop at its acceptance gate.

If `CURRENT_TASK.md` says `Status: BLOCKED`, do not invent work around the blocker. Report the smallest concrete action needed from Daniel.

## Durable progress and stalled sessions

GitHub state is durable; agent conversations are disposable.

- Commit and push the first coherent, testable slice early.
- Open a draft pull request as soon as the work is inspectable; do not wait for polish.
- Work that exists only inside a conversation or unpushed working tree is not safely in progress.
- When a session stalls, follow the one-attempt recovery procedure in `docs/EXECUTION_RECOVERY_PROTOCOL.md`.
- Continue a stalled session only when it can identify its branch, commit, changed files, commands run, exact blocker, and smallest next action.
- Replace a session that cannot expose useful repository state or repeatedly discusses the task without executing.
- Never use repeated `continue` or `try again` loops as a substitute for a branch, commit, draft PR, or concrete blocker.

## Instruction hierarchy

When instructions differ, use this order:

1. Daniel's latest explicit instruction
2. `CURRENT_TASK.md`
3. The active GitHub issue
4. This `AGENTS.md`
5. Other documents under `docs/`

Never begin the next GitHub issue merely because the current implementation seems easy to extend.

## Product promise

A judge can:

1. Open a World Cup fixture.
2. See TxLINE market probabilities.
3. Enter personal probabilities.
4. See the strongest disagreement and clearest available expression.
5. Replay the fixture to resolution.
6. Inspect a TxLINE-backed result receipt.

## Repository isolation

This repository is independent from MSOS and Autobuilder during the hackathon.

- Do not read, modify, import from, or create dependencies on sibling repositories.
- Do not use workspace links, submodules, local-path dependencies, or copied environment files from MSOS or Autobuilder.
- Reimplement only the minimum logic required for this demo.
- Any future integration with MSOS requires a separate post-hackathon migration decision.
- Until the hackathon submission is complete, do not invoke, modify, configure, deploy through, or point Autobuilder at Match Horizon.
- A future Autobuilder exception requires Daniel's explicit approval for one bounded action after its risk is reviewed; general tool approval does not waive repository isolation.

## Hard scope boundaries

Do not add any of the following unless explicitly requested:

- Wagering
- Wallet custody
- Escrow
- Smart contracts
- AMMs or order books
- User accounts
- Databases
- AI chat or generated pundit commentary
- Multiple sports
- Additional market types
- Social features
- Complex bankroll or expected-value tooling

## Engineering rules

1. Real TxLINE payloads must be probed before UI assumptions are implemented.
2. Raw TxLINE schemas stay inside `src/lib/txline`.
3. UI components consume normalized domain types only.
4. Unsupported or ambiguous data must fail explicitly; never guess silently.
5. Historical replay must be deterministic and work without network access after capture.
6. Credentials must remain server-side and must never be committed, printed, or copied into issues or chat.
7. Every phase must pass its gate before the next phase begins.
8. Prefer the smallest working implementation over abstraction.
9. Do not refactor unrelated code.
10. Run build, typecheck, lint, and tests before declaring a task complete.
11. Do not use breaking dependency upgrades merely to silence an audit warning without reviewing the impact.
12. Preserve parallel ownership: Issue #3 owns the core page and UI; Issue #4 capture work owns replay capture, fixtures, timeline utilities, validation, tests, and replay documentation until UI integration is explicitly assigned.

## Completion report

At the end of a work session, report:

1. Files changed
2. Commands run and their results
3. Real external data successfully retrieved
4. Blockers or unresolved assumptions
5. Whether the active acceptance gate passed
6. Branch, commit, and pull-request status
7. The exact next action, without starting it

## Review priorities

1. Demo-breaking defects
2. Secret exposure
3. Incorrect probability interpretation
4. Unsupported TxLINE schema assumptions
5. Replay nondeterminism
6. Deployment failure
7. Scope expansion

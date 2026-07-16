# Match Horizon Execution and Recovery Protocol

**Applies through the July 19, 2026 submission deadline.**

This protocol keeps implementation recoverable when a Codex conversation stalls and protects Match Horizon from accidental coupling to MSOS or Autobuilder.

## 1. Source of truth

GitHub is the source of truth.

- Branches, commits, pull requests, issues, committed fixtures, and recorded validation results are durable evidence.
- A Codex conversation is a temporary worker, not a durable project state.
- Work that exists only inside a conversation is not considered safely in progress.
- Never claim completion, runtime success, deployment, or captured data without current evidence.

## 2. Start every implementation session from repository state

Before editing:

1. Read `AGENTS.md` and `CURRENT_TASK.md`.
2. Read the active issue and referenced project documents.
3. Inspect `git status -sb`, the current branch, and the current commit.
4. Confirm that the branch started from the required dependency state.
5. Confirm that no other active worker owns the same files or UI surface.

If the required dependency is not merged, report the blocker and stop. Do not build around it or silently copy code across branches.

## 3. Push recoverable work early

Do not wait for polish or full completion before creating durable GitHub state.

- Commit after the first coherent, testable slice.
- Push the branch early.
- Open a draft pull request once the work has enough structure to inspect.
- Keep the draft PR description current with scope, commands run, known gaps, and the exact next step.
- Never leave the only useful implementation inside an unpushed working tree or conversation.

## 4. One-attempt stall recovery

When a Codex session stalls, loses context, or repeatedly says it is blocked, make one structured recovery attempt.

The worker must report:

1. current branch;
2. current commit SHA;
3. `git status -sb`;
4. files changed;
5. commands run and results;
6. the exact blocker or error;
7. whether useful work can be committed and pushed now;
8. the smallest next action.

Continue the existing session only when it has concrete repository state and a narrow, evidenced blocker.

Replace the session when it:

- has no identifiable branch or commit;
- cannot expose useful changed files or a pushable diff;
- repeatedly discusses the task without executing;
- cannot state the exact blocker;
- loses the active issue or scope boundary;
- proposes architecture redesign instead of the next acceptance-gate step;
- starts modifying files owned by another active workstream.

Do not create repeated `continue`, `try again`, or motivational loops. Preserve the branch if useful; replace the conversation if not.

## 5. Parallel ownership

Until the core vertical slice is stable:

- Issue #3 owns the core page, fixture and market display, belief editor, disagreement presentation, expression presentation, and core UI styling.
- Issue #4 capture work owns capture scripts, sanitized replay fixtures, replay-domain types, timeline utilities, validation commands, tests, and replay documentation.
- Issue #4 must not add or redesign the main UI while Issue #3 owns it.
- Replay UI integration begins only after the Issue #3 page structure is clear.
- No two workers may edit the same files concurrently without an explicit coordination decision.

## 6. Submission-safe critical path

Prioritize in this order:

1. Merge the accepted normalization layer.
2. Complete the full belief-comparison flow.
3. Capture and validate one deterministic completed-fixture replay.
4. Add replay UI and the result receipt.
5. Deploy and smoke-test the public application.
6. Finish README, demo script, video, and submission.
7. Perform only demo-breaking fixes on submission day.

Historical odds movement is optional. If it is unavailable, retain the real initial captured odds snapshot and replay only real score/finalization data. Never invent price movement or core records.

## 7. Autobuilder isolation freeze

Until the hackathon submission is complete, Match Horizon must not:

- invoke or modify Autobuilder;
- use Autobuilder as an implementation or deployment path;
- point Autobuilder at the Match Horizon working directory;
- import Autobuilder code or configuration;
- share environment files, credentials, workspaces, or local-path dependencies with Autobuilder;
- change Autobuilder in order to support this repository.

A future exception requires Daniel's explicit approval for one bounded action after its risk is reviewed. General approval to use tools does not waive repository isolation.

The safe post-submission use is to treat Match Horizon as a controlled external test case for Autobuilder, not as a dependency of the hackathon build.

## 8. Completion and coordination report

Every implementation handoff must include:

- branch and commit;
- draft or final PR link;
- files changed;
- commands run and results;
- real external data retrieved, if any;
- acceptance-gate status;
- blockers and evidence gaps;
- ownership overlap;
- exact next action.

When another workstream matters, include:

```text
COORDINATION STATUS
Agreement: aligned | partial | conflict | unknown
Compared: <issues / PRs / commits / files / runtime evidence>
Disagreement: <none or concise statement>
Evidence gap: <none or missing proof>
Ownership overlap: <none or overlapping paths/state>
Risk if unresolved: <none or consequence>
Recommended default: <one action>
Founder decision required: yes | no
```

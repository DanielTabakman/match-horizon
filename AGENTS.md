# AGENTS.md — Match Horizon

This repository is a narrow hackathon build. Read the charter and demo contract before modifying code.

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
- Do not invoke or integrate Autobuilder unless Daniel explicitly approves it for this repository.

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
6. Credentials must remain server-side and must never be committed.
7. Every phase must pass its gate before the next phase begins.
8. Prefer the smallest working implementation over abstraction.
9. Do not refactor unrelated code.
10. Run build, typecheck, lint, and tests before declaring a task complete.

## Required first implementation task

Implement only a TxLINE connectivity probe that:

- validates environment variables;
- fetches fixtures;
- selects one World Cup fixture;
- fetches odds and score data for that fixture;
- prints representative keys and record counts;
- stores sanitized samples for tests;
- makes no product UI changes.

## Review priorities

1. Demo-breaking defects
2. Secret exposure
3. Incorrect probability interpretation
4. Unsupported TxLINE schema assumptions
5. Replay nondeterminism
6. Deployment failure
7. Scope expansion

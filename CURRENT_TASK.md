# Current Task

**Status:** ISSUE #2 GATE PASSED - DRAFT PR OPEN
**Active issue:** [#2 - Phase 2: Normalize the observed TxLINE fixture, odds, and score data](https://github.com/DanielTabakman/match-horizon/issues/2)
**Active pull request:** [#7 - Issue 2: normalize observed TxLINE captures](https://github.com/DanielTabakman/match-horizon/pull/7)
**Active branch:** `codex/issue-2-txline-normalizers`
**Scope:** Implement only Phase 2 from updated `main`.

## Inputs

- Committed sanitized TxLINE captures under `test-fixtures/txline/`
- Issue #2 acceptance gate
- `docs/TXLINE_DATA_CONTRACT.md`
- `docs/BUILD_SEQUENCE.md`

## Required output

1. Raw TxLINE schemas isolated under `src/lib/txline`.
2. Fixture normalizer.
3. Full-match three-way result odds normalizer.
4. Score-event normalizer.
5. Normalized domain types.
6. Deterministic fixture-based tests using the committed sanitized samples.
7. Explicit unsupported or ambiguous data errors.
8. Short observed-data document for market identifiers, periods, outcome names, probability scale, and participant mapping.

## Hard stops

- Do not begin Issue #3.
- Do not add market types beyond full-match three-way result.
- Do not infer undocumented TxLINE meanings.
- Do not let raw TxLINE fields leak into UI components.
- Do not use, read from, modify, or depend on MSOS or Autobuilder.

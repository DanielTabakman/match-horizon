# Decisions

## D-001 — Build a separate public repository

**Decision:** Match Horizon is an independent hackathon application rather than a direct modification of MSOS.

**Reason:** The hackathon creates a distinct public submission, deployment, deadline, and experimental lifecycle. Isolation reduces risk while MSOS and Autobuilder are being separated.

**Constraint:** This is not a general “one repo per feature” rule. New repositories are justified only by a real ownership, deployment, security, or lifecycle boundary.

**Future compatibility:** Reusable domain concepts may later move into MSOS through an explicit migration.

---

## D-002 — Do not interfere with the MSOS/Autobuilder split

**Decision:** Match Horizon does not read, modify, import from, deploy through, or depend on either repository during the hackathon.

**Reason:** Combining an active repository split with deadline-driven product work would make failures harder to attribute and reverse.

---

## D-003 — Autobuilder requires explicit approval

**Decision:** Autobuilder will not be invoked or integrated for Match Horizon unless Daniel explicitly approves it first.

**Reason:** The build must remain independent from the system currently being separated and stabilized.

---

## D-004 — Support only three-way match result

**Decision:** The initial product supports Team A, Draw, and Team B.

**Reason:** It provides a complete belief-comparison loop with minimal schema and UX complexity.

---

## D-005 — No wagering or custody

**Decision:** The application is analytical and read-only.

**Reason:** Smart contracts, custody, legal surface, and settlement mechanics do not improve the required demo enough to justify the risk.

---

## D-006 — Historical replay is mandatory

**Decision:** The primary demo uses captured historical TxLINE data.

**Reason:** Judges may review when no match is live. Determinism is more valuable than nominal liveness.

---

## D-007 — Live mode is secondary

**Decision:** Live polling or SSE is added only after the replay demo passes.

**Reason:** Persistent streams and match schedules create avoidable demo risk.

---

## D-008 — Verification claims are tiered

**Decision:** The UI separately reports data source, proof availability, local checks, and on-chain validation.

**Reason:** Trust requires precise claims rather than decorative blockchain language.

---

## D-009 — Codex receives bounded tasks

**Decision:** Each implementation phase is assigned separately and committed after its gate passes.

**Reason:** Large autonomous prompts increase scope drift and make failures harder to reverse.

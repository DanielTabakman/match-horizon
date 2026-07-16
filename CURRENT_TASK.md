# Current Task

**Status:** CORE DEMO MERGED — ISSUE #5 DEPLOYMENT AND SUBMISSION PRIMARY

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#4 — Historical replay](https://github.com/DanielTabakman/match-horizon/issues/4) is complete.

**Active issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5)

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

The complete judge flow is now on `main`:

**Market belief → Personal belief → Disagreement → Expression → Deterministic replay → Final result receipt**

## Primary workstream A — deploy and smoke-test

Deploy current `main` as a separate public project, preferably on Vercel.

Requirements:

- Use the `DanielTabakman/match-horizon` repository and current `main`.
- Keep the deployment separate from MSOS and Autobuilder.
- The judge flow must default to the bundled committed replay and require no network access after the page loads.
- No TxLINE credential is required for the public judge flow. Do not add a credential or live API dependency merely for deployment.
- Record the public application URL in the README and submission checklist after it is stable.

Run an incognito desktop and mobile-width smoke test covering:

1. page loads without authentication;
2. real France vs Spain market probabilities are visible;
3. belief inputs accept a valid 100% total;
4. disagreement and selected expression are understandable;
5. Start, Pause, Play, Restart, 1x, and 4x controls work;
6. unknown scores are not displayed as invented zeroes;
7. replay reaches the real France 0–Spain 2 result;
8. restart produces the same visible sequence and result;
9. receipt says `TxLINE data received: yes`, `Proof available: no`, `Proof structure checked: no`, and `On-chain validated: no`;
10. no secrets, console-breaking errors, horizontal mobile overflow, or unusable controls are present.

Only fix demonstrated demo-breaking defects. Do not redesign the product.

## Approved parallel workstream B — documentation and submission package

Use a separate clean worktree and avoid application-code files unless a reviewed factual correction requires one.

Owned paths:

- `README.md`
- `docs/` submission, architecture, demo, and checklist files

Deliver:

- accurate product summary and core flow;
- architecture overview;
- exact TxLINE categories and endpoints used;
- local setup and validation commands;
- deterministic replay explanation;
- known limitations, including fixed historical market probabilities;
- precise proof and on-chain verification language;
- TxLINE API feedback;
- public application link once available;
- demo script under five minutes;
- technical submission summary;
- completed submission checklist.

Do not describe the deployed demo as live, continuously updating, cryptographically verified, proof-validated, or on-chain validated. The demo uses real captured TxLINE data and a deterministic bundled replay.

## Required checks after any code change

- `npm run replay:validate`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Final acceptance gate

- public application opens in an incognito browser;
- desktop and mobile-width smoke tests pass;
- deterministic replay completes and restarts correctly;
- README accurately matches the implementation;
- no credentials or private paths are exposed;
- application URL, repository URL, demo video, technical summary, and checklist are ready;
- every verification claim is supported by implemented evidence.

## Hard stops

- Do not use, modify, configure, deploy through, or depend on MSOS or Autobuilder.
- Do not add live TxLINE dependency to the judge flow.
- Do not invent historical odds movement, proof payloads, or verification results.
- Do not add wagering, wallets, databases, accounts, AI analysis, extra sports, or extra market types.
- Do not start architecture refactoring or broad visual redesign.

## Immediate priority

1. Deploy current `main` and obtain the public URL.
2. Smoke-test the public application and fix only demonstrated blockers.
3. Complete README and submission documents in parallel.
4. Record the final demo video.
5. Submit before the deadline.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

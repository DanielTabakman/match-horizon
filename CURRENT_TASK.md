# Current Task

**Status:** PUBLIC DEMO VERIFIED — VIDEO AND FINAL SUBMISSION PRIMARY

**Completed foundations:**

- [#10 — Belief comparison](https://github.com/DanielTabakman/match-horizon/pull/10) is merged.
- [#11 — Deterministic replay capture](https://github.com/DanielTabakman/match-horizon/pull/11) is merged.
- [#14 — Replay UI and result receipt](https://github.com/DanielTabakman/match-horizon/pull/14) is merged.
- [#16 — Submission documentation](https://github.com/DanielTabakman/match-horizon/pull/16) is merged.
- [#4 — Historical replay](https://github.com/DanielTabakman/match-horizon/issues/4) is complete.

**Active issue:** [#5 — Deploy and prepare the submission](https://github.com/DanielTabakman/match-horizon/issues/5)

**Submission deadline:** July 19, 2026 at 23:59 UTC / 7:59 PM America/Toronto.

**Public demo:** https://match-horizon.vercel.app

The project owner reported successful production smoke tests in an incognito desktop browser and at mobile width on July 16, 2026. The deployed judge flow opens without authentication, completes the deterministic replay, reaches France 0–Spain 2, restarts correctly, and shows the precise verification receipt.

The complete judge flow is:

**Market belief → Personal belief → Disagreement → Expression → Deterministic replay → Final result receipt**

## Primary workstream — record the demo video

Use `docs/DEMO_SCRIPT.md` and keep the video under five minutes.

The video must show:

1. the production URL;
2. France vs Spain and the real initial TxLINE probabilities;
3. a valid user belief totaling 100%;
4. the strongest positive disagreement and selected expression;
5. Start, Pause, Play, Restart, 1x, and 4x controls;
6. unknown score state before observed totals;
7. the real France 0–Spain 2 final result;
8. the result receipt;
9. the fixed historical market limitation;
10. `Proof available: no`, `Proof structure checked: no`, and `On-chain validated: no`;
11. the repository URL.

Upload the recording and record the final video URL in the README or submission checklist.

## Final submission workstream

Before sending the form:

- perform a final repository-history secret scan or equivalent review;
- enter the public repository URL;
- enter `https://match-horizon.vercel.app` as the working application;
- enter the demo video URL;
- use `docs/TECHNICAL_SUBMISSION_SUMMARY.md` for the technical overview;
- use the README TxLINE API feedback for positive feedback and friction;
- complete team and eligibility fields;
- verify every required field once before submission.

## Hard stops

- Do not add product scope.
- Do not redesign or refactor the application.
- Do not add live TxLINE dependency to the judge flow.
- Do not claim proof validation, cryptographic verification, or on-chain validation.
- Do not use, modify, configure, deploy through, or depend on MSOS or Autobuilder.
- Do not expose credentials or private local paths.

## Immediate priority

1. Record the demo video.
2. Upload it and record the video URL.
3. Complete the secret review.
4. Fill and submit the hackathon form.
5. Close Issue #5 only after submission is confirmed.

Every Codex session must follow `docs/EXECUTION_RECOVERY_PROTOCOL.md` and push durable branch/PR state early.

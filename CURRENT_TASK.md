# Current Task

**Status:** ACTIVE  
**Active issue:** [#1 — Scaffold the app and prove TxLINE connectivity](https://github.com/DanielTabakman/match-horizon/issues/1)  
**Active pull request:** [#6 — scaffold app and add TxLINE probe](https://github.com/DanielTabakman/match-horizon/pull/6)  
**Active branch:** `agent/issue-1-txline-probe`  
**Scope:** Finish Issue #1 only. Do not begin Issue #2.

## Current state

The Issue #1 implementation is committed and pushed in draft PR #6.

Reported checks:

- Typecheck passed
- Lint passed
- Eight tests passed
- Production build passed
- The probe correctly stopped at `missing_configuration`

The live-data acceptance gate remains open because no activated TxLINE API token has been supplied and no real payload has been captured.

## Operating instruction

1. Work on the existing PR #6 branch. Do not create a duplicate implementation or a new PR.
2. Read `docs/TXLINE_ACTIVATION_RUNBOOK.md`.
3. Do not begin Issue #2.
4. Stop whenever a wallet signature, API token, secret, or other user-controlled action is required.
5. Never request that a secret be pasted into a prompt, GitHub, logs, or committed files.
6. Do not use MSOS or Autobuilder. Autobuilder requires Daniel's explicit prior approval.

## Required final hardening before live probe

Eliminate the invalid state where `TXLINE_NETWORK` and `TXLINE_API_ORIGIN` can refer to different networks.

Preferred design:

```text
mainnet -> https://txline.txodds.com
devnet  -> https://txline-dev.txodds.com
```

Derive `apiOrigin` from `TXLINE_NETWORK` and require only:

- `TXLINE_NETWORK`
- `TXLINE_API_TOKEN`

Keep optional:

- `TXLINE_DEMO_FIXTURE_ID`

An explicit host override may exist only when clearly named as an advanced override and validated; it must not be normal required configuration.

Update `.env.example` and tests to match. Preserve runtime guest-JWT acquisition and the one-time retry after HTTP 401. Do not retry HTTP 403.

## User-controlled activation

The official activation procedure is documented in:

```text
docs/TXLINE_ACTIVATION_RUNBOOK.md
```

Use devnet first with a disposable funded devnet wallet. The activated token must be stored only in `.env.local` or a secure secret store.

Do not create an activation implementation inside Match Horizon unless explicitly requested. Prefer TxLINE's official runnable devnet script.

## Live-data gate

After an activated token exists locally:

```text
npm run txline:probe
```

The gate passes only when the probe:

- authenticates successfully;
- retrieves a real World Cup fixture;
- retrieves a real fixture-specific odds response;
- retrieves current or historical score data, or clearly documents why the selected fixture has none;
- saves sanitized real samples without credentials.

After the live probe:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Commit and push the changes to the existing PR #6 branch. Keep the PR in draft until the live-data gate passes.

## Stop condition

Stop and report rather than beginning Issue #2 when either:

- the Issue #1 live-data gate passes; or
- a wallet, token activation, secret entry, or other user-controlled step is required.

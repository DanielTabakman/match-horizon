# Current Task

**Status:** ACTIVE  
**Active issue:** [#1 — Scaffold the app and prove TxLINE connectivity](https://github.com/DanielTabakman/match-horizon/issues/1)  
**Scope:** Finish Issue #1 only. Do not begin Issue #2.

## Current state

The minimal Next.js and TypeScript scaffold and TxLINE probe have been implemented locally.

Reported checks:

- Typecheck passed
- Lint passed
- Seven tests passed
- Production build passed
- The probe correctly failed with `missing_configuration`

The Issue #1 acceptance gate has not passed because no authenticated TxLINE payload has been retrieved yet.

## Required correction

Revise the TxLINE authentication model before attempting the live probe:

1. `TXLINE_GUEST_JWT` is not required configuration.
2. Fetch a fresh guest JWT at runtime with:

   ```text
   POST ${TXLINE_API_ORIGIN}/auth/guest/start
   ```

3. Send the returned JWT on TxLINE data requests as:

   ```text
   Authorization: Bearer <guest-jwt>
   ```

4. Send the activated API token as:

   ```text
   X-Api-Token: <api-token>
   ```

5. If a data request returns HTTP 401, fetch one new guest JWT and retry that request exactly once.
6. Do not retry HTTP 403 responses.
7. Required configuration remains:
   - `TXLINE_API_ORIGIN`
   - `TXLINE_API_TOKEN`
   - `TXLINE_NETWORK`
8. `TXLINE_DEMO_FIXTURE_ID` remains optional.
9. Update configuration tests and `.env.example` to match.
10. Never log, commit, or include credentials in saved samples.

## Finish the local implementation

After the authentication correction:

1. Run:

   ```text
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

2. Preserve the current work and put Issue #1 changes on a dedicated branch. Preferred branch:

   ```text
   agent/issue-1-txline-probe
   ```

3. Commit with a focused message such as:

   ```text
   feat: scaffold app and add TxLINE probe
   ```

4. Push the branch and open a draft pull request linked to Issue #1.
5. Do not close Issue #1 yet.

## Live-data gate

When a valid activated TxLINE API token is available only in the local environment, run:

```text
npm run txline:probe
```

The gate passes only when the probe:

- authenticates successfully;
- retrieves a real fixture;
- retrieves a real fixture-specific odds response;
- retrieves current or historical score data, or clearly documents why the selected fixture has none;
- saves sanitized real samples without secrets.

After the live probe, rerun all checks and update the draft pull request.

## Stop condition

Stop and report rather than beginning Issue #2 when either:

- the Issue #1 gate passes; or
- an API token, account activation, or other user-controlled credential is required.

Do not use MSOS or Autobuilder. Do not use Autobuilder without Daniel's explicit approval.

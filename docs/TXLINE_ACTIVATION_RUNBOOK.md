# TxLINE Activation Runbook

This is the only user-controlled setup required before Issue #1 can pass its live-data gate.

## Network choice

Use devnet first.

- `TXLINE_NETWORK=devnet`
- TxLINE API host: `https://txline-dev.txodds.com`
- Solana RPC: `https://api.devnet.solana.com`
- TxLINE devnet program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- TxL devnet mint: `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`
- Free service level: `1`

The API host is derived from `TXLINE_NETWORK`; do not configure an independent host unless a documented advanced override is explicitly needed.

## Safety

- Use a fresh disposable devnet wallet.
- Never paste a seed phrase, wallet JSON, guest JWT, activated API token, or authorization header into GitHub, a prompt, or a support channel.
- Keep the wallet file outside this repository.
- Keep the activated API token only in `.env.local` or a secure secret store.
- Do not use Autobuilder.

## Official activation path

Use TxLINE's official runnable devnet examples from the `txodds/tx-on-chain` repository. The free-tier script is:

```text
examples/devnet/scripts/subscription_free_tier.ts
```

It requires Node.js 20 or newer, a funded devnet wallet, and these environment values:

```text
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=<absolute path to disposable devnet wallet json>
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG
```

Run the official free-tier script from the official repository. It should:

1. submit the free-tier on-chain subscription;
2. fetch a guest JWT from the devnet host;
3. sign the exact activation message with the subscribing wallet;
4. call the devnet activation endpoint;
5. return an activated API token.

The free tier requires no TxL purchase, but the wallet still needs devnet SOL for fees and possible account rent.

## Match Horizon local configuration

After activation, create `match-horizon/.env.local`:

```text
TXLINE_NETWORK=devnet
TXLINE_API_TOKEN=<activated token>
TXLINE_DEMO_FIXTURE_ID=
```

Do not commit this file.

## Live probe

From the Match Horizon repository:

```text
npm run txline:probe
```

The gate passes when the probe retrieves a real fixture, fixture-specific odds, score data or a documented empty score state, and writes sanitized samples without secrets.

Then run:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Push the updated Issue #1 branch and keep PR #6 in draft until the live-data gate passes.

## Stop conditions

Stop and report rather than improvising when:

- the official activation script fails;
- the devnet wallet cannot be funded;
- activation returns 403;
- the API token is rejected;
- the observed payload contradicts the documented endpoint shape;
- a secret may have been exposed.

# Match Horizon

Match Horizon helps a user compare live sports-market probabilities with their own beliefs, identify the largest disagreement, and watch that view resolve against verified TxLINE match data.

## Hackathon objective

Deliver a deployed, working World Cup demo that:

1. Loads a real fixture and market probabilities from TxLINE.
2. Lets the user enter their own three-way match-result probabilities.
3. Calculates and explains the strongest disagreement.
4. Replays one completed match deterministically.
5. Ends with a human-readable TxLINE result and verification receipt.

## Core product loop

**Market belief → User belief → Disagreement → Best expression → Resolution**

## Initial supported scope

- Soccer only
- One fixture at a time
- Full-match three-way result only: Team A, Draw, Team B
- Read-only product
- No wagering, custody, escrow, or user accounts
- Historical replay must work without a live match

## Repository role

This is an isolated public hackathon prototype and a potential future MSOS module. It has no runtime or code dependency on MSOS or Autobuilder during the hackathon.

## Documents

- [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md)
- [`docs/DEMO_CONTRACT.md`](docs/DEMO_CONTRACT.md)
- [`docs/TXLINE_DATA_CONTRACT.md`](docs/TXLINE_DATA_CONTRACT.md)
- [`docs/BUILD_SEQUENCE.md`](docs/BUILD_SEQUENCE.md)
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`AGENTS.md`](AGENTS.md)

## Current status

Chartered. No implementation assumption is considered proven until the TxLINE probe captures real fixture, odds, and score payloads.

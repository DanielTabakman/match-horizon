# Match Horizon — Project Charter

**Status:** Locked for implementation  
**Charter date:** July 13, 2026  
**Submission deadline:** July 19, 2026 at 23:59 UTC

## 1. Product statement

Match Horizon helps a sports fan compare the market's current probability estimate with their own belief, identify the outcome where they disagree most, and understand the prediction that most directly expresses that view.

TxLINE is the primary source for fixture, odds, score, and verification data.

## 2. Core user question

> What does the market believe, what do I believe, and where do we disagree?

## 3. Core product loop

1. Select a World Cup fixture.
2. View normalized market probabilities.
3. Enter personal probabilities.
4. Calculate outcome-by-outcome disagreement.
5. Highlight the strongest positive disagreement.
6. Name the clearest available expression.
7. Replay market and score changes.
8. Resolve the view against the verified final result.

## 4. Target user

A soccer fan or analytically minded market participant who understands match outcomes but does not want to interpret raw bookmaker odds or fragmented sports feeds.

## 5. Demo promise

A judge can complete the full product loop in under five minutes without needing a live match.

## 6. Initial supported scope

### Included

- World Cup soccer fixtures supplied by TxLINE
- One fixture at a time
- Full-match three-way result market:
  - Team A wins
  - Draw
  - Team B wins
- Market probabilities normalized from real TxLINE data
- User-entered probabilities totaling 100%
- Deterministic disagreement calculation
- Plain-language expression recommendation
- Historical score and odds replay where available
- Human-readable result and proof receipt
- Public deployed web application
- Public repository and concise technical documentation

### Explicit non-goals

- Real-money betting or wagering
- Peer-to-peer transfers
- Escrow or custody
- Custom Solana program
- AMM or order book
- Wallet-required consumer flow
- User accounts
- Persistent database
- Multiple sports
- Multiple market types
- Player props, corners, cards, or totals
- AI chat, pundit generation, or autonomous agents
- Bankroll sizing or personalized financial advice

## 7. Deterministic product logic

For each supported outcome:

`disagreement = user_probability - market_probability`

The strongest disagreement is the supported outcome with the highest positive difference.

If no outcome has a positive difference, the product states that the user has no positive disagreement with the displayed market snapshot.

The initial expression recommendation is the same three-way match-result outcome. The product must not imply sophisticated optimization that has not been implemented.

## 8. Architecture boundary

```text
TxLINE raw payload
        ↓
TxLINE adapter and validators
        ↓
Match Horizon domain model
        ↓
Belief evaluation
        ↓
UI and replay
```

Raw TxLINE fields must not leak into React components.

## 9. Repository and system boundary

Match Horizon is an isolated hackathon prototype.

- It has no runtime dependency on MSOS.
- It has no runtime dependency on Autobuilder.
- It uses a separate deployment and separate environment variables.
- It must not modify either repository during the hackathon.
- Autobuilder may not be used for this project without Daniel's explicit approval.
- Reusable concepts may be migrated into MSOS only after the hackathon through a separate decision.

## 10. Primary success criteria

The project passes only when all of the following are true:

- A real TxLINE fixture is displayed.
- Real TxLINE market data is normalized into probabilities.
- A user can enter a valid belief totaling 100%.
- The disagreement calculation is deterministic and tested.
- One captured match can replay from initial state to final result.
- The deployed demo works when no match is live.
- No TxLINE credential is exposed to the browser or repository.
- The result receipt is based on real TxLINE score or proof data.
- The public README explains exactly which TxLINE data was used.
- A demo video shows the complete user loop.

## 11. Product risks

### Highest risk: TxLINE schema ambiguity

Mitigation: probe and capture real payloads before building UI assumptions.

### Highest demo risk: dependence on live activity

Mitigation: historical capture and deterministic replay are mandatory.

### Highest execution risk: scope expansion

Mitigation: all excluded features remain excluded until the core demo contract passes.

### Highest trust risk: overstating verification

Mitigation: distinguish clearly between:

- data received from TxLINE;
- proof payload displayed;
- proof structure validated locally;
- actual on-chain validation executed.

## 12. Submission story

> Sportsbooks show odds. Match Horizon translates TxLINE's market data into probabilities, lets a fan compare those probabilities with their own view, identifies the clearest disagreement, and then replays the match to a TxLINE-backed resolution receipt.

## 13. Post-hackathon relevance

This project is a bounded sports implementation of a reusable market-reasoning workflow:

**Market belief → Personal belief → Disagreement → Expression → Resolution**

Reusable components may later become part of MSOS/PPE, but the hackathon repository remains independently deployable and understandable.

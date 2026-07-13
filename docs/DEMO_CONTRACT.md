# Demo Contract

The demo is the product. Every implementation decision should improve the reliability or clarity of this sequence.

## Required demo sequence

### Scene 1 — Select a fixture

The judge sees a real World Cup fixture supplied by TxLINE.

Required information:

- Team names
- Start time or completed status
- Fixture identifier
- Data source indicator

### Scene 2 — Understand market belief

The judge sees three normalized probabilities:

- Team A wins
- Draw
- Team B wins

The probabilities must be labeled clearly and total approximately 100%.

### Scene 3 — Enter a personal belief

The judge enters personal probabilities totaling exactly 100%.

The interface must prevent or clearly reject invalid totals.

### Scene 4 — See the disagreement

The application displays:

- Market probability
- User probability
- Difference in percentage points
- Strongest positive disagreement
- Plain-language explanation

### Scene 5 — See the expression

The application names the supported match-result outcome that directly expresses the user's strongest disagreement.

It must not claim to place a bet or optimize a portfolio.

### Scene 6 — Replay the match

The judge starts a deterministic historical replay.

The replay updates, where captured data permits:

- Match clock or event time
- Score
- Market probabilities
- Current disagreement
- A concise event timeline

Required controls:

- Play
- Pause
- Restart
- At least one accelerated speed

### Scene 7 — Resolve the view

The replay reaches a final result.

The application shows:

- Final score
- Finalized status
- Whether the selected outcome occurred
- User's original belief snapshot
- Initial market snapshot
- A TxLINE-backed result receipt

## Demo duration target

3 to 4 minutes, leaving time in the five-minute video for:

- problem framing;
- architecture explanation;
- TxLINE integration;
- limitations and next step.

## Demo reliability requirements

- The core replay must run from a local captured file.
- The application must not require a live match.
- The replay must produce the same sequence every time.
- Network failure must not break the captured demo route.
- Secrets must not appear in browser developer tools.
- The deployed URL must work in an incognito browser.

## Failure conditions

The demo contract fails if:

- the only data is mocked or invented;
- probabilities are based on guessed field semantics;
- the app depends on a live SSE event occurring;
- the user cannot complete the belief flow;
- the replay does not reach a final state;
- verification language overstates what the code actually validates;
- a credential is exposed;
- the application is only a wireframe.

## Stretch features allowed only after the contract passes

- Live polling mode
- Live SSE mode
- Read-only Solana validation
- Saved local thesis
- Additional fixture selection
- Improved animations and transitions

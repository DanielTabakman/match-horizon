# Under-Five-Minute Demo Script

Target length: 3:30 to 4:30.

Public demo URL: **PUBLIC_VERCEL_URL_PLACEHOLDER - replace after deployment smoke tests pass**

## 0:00-0:20 - Problem

"Sports odds are hard to reason about directly. Match Horizon turns TxLINE market data into probabilities, lets a fan enter their own view, identifies the clearest disagreement, and resolves that view against a captured match result."

## 0:20-0:50 - Fixture And Market

Open the app.

Call out:

- France vs Spain, fixture `18237038`.
- TxLINE market snapshot captured on `2026-07-14T18:42:08.439Z`.
- Three-way match-result probabilities:
  - France `37.272%`
  - Draw `31.837%`
  - Spain `30.893%`

"This is a real captured TxLINE fixture and market snapshot, normalized into a simple three-outcome domain model."

## 0:50-1:30 - User Belief And Disagreement

Enter a valid belief that totals `100%`, for example:

- France: `25`
- Draw: `25`
- Spain: `50`

Call out:

- The form requires exactly `100%`.
- The disagreement is `user probability - market probability`.
- Spain should become the strongest positive disagreement in this example.

"The app is not placing a wager. It is naming the plain match-result expression that most directly represents the user's view."

## 1:30-2:35 - Deterministic Replay

Start the replay.

Show:

- Start or Play.
- Pause.
- Resume Play.
- Switch between `1x` and `4x`.
- Restart and note that it returns to the same beginning state.
- Unknown scores remain unknown until TxLINE score totals appear.

"The replay is bundled and deterministic so judges do not need a live match. The market remains the fixed initial captured snapshot because historical odds movement was not available for this completed fixture."

## 2:35-3:20 - Final Result Receipt

Let the replay reach the final result: France `0`, Spain `2`.

Show the receipt:

- Final score.
- Finalization status.
- Original user probabilities.
- Initial TxLINE market probabilities.
- Whether the selected expression occurred.
- `TxLINE data received: yes`.
- `Proof available: no`.
- `Proof structure checked: no`.
- `On-chain validated: no`.

"The result is backed by captured TxLINE score data, including a `game_finalised` event. It is not claimed as proof-validated or on-chain validated."

## 3:20-4:10 - Architecture And Limits

"The architecture keeps raw TxLINE schemas inside `src/lib/txline`, normalizes them into domain types, runs deterministic belief and replay logic, and renders the UI from those normalized objects. The public demo uses committed sanitized captures and does not require browser credentials."

Mention limitations:

- One fixture: France vs Spain.
- One market type: full-match three-way result.
- Fixed initial market during replay.
- No proof payload identified yet.
- No on-chain validation executed.
- No wagering, wallet, custody, account, or database scope.

## 4:10-4:30 - Close

"The complete loop is market belief, personal belief, disagreement, expression, replay, and receipt. The repository is public, the deployment is separate from MSOS and Autobuilder, and the demo is designed to work even when no live match is available."

Show:

- Public demo URL placeholder or final URL.
- Repository URL: `https://github.com/DanielTabakman/match-horizon`.

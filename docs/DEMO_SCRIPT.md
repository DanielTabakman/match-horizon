# Under-Five-Minute Demo Script

Target length: 3:30 to 4:30.

Public demo URL: https://match-horizon.vercel.app

## 0:00-0:20 - Problem

"Sports odds are hard to reason about directly. Match Horizon turns TxLINE market data into probabilities, lets a fan enter their own view, identifies the clearest disagreement, builds a simulated execution route, and resolves that view against a captured match result."

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

## 1:30-2:25 - Simulated Execution Route

Use the default Spain example.

Call out:

- The panel says `Simulation only - no wager submitted`.
- Requested stake defaults to `$5,000`.
- Minimum decimal odds defaults to `3.30`.
- The simulated liquidity uses generic venue names only.
- Build the route.
- The fills should be `$500` at `3.50`, `$2,000` at `3.42`, and `$2,500` at `3.30`.
- Filled stake should be `$5,000`.
- Weighted-average odds should display as `3.37`.
- Estimated gross payout should be `$16,840`.

"This is not TxLINE venue data and not a live order. It is a deterministic routing calculation over committed simulated liquidity so the belief-to-execution story can be judged safely."

## 2:25-3:20 - Deterministic Replay

Start the replay.

Show:

- Start or Play.
- Pause.
- Resume Play.
- Switch between `1x` and `4x`.
- Restart and note that it returns to the same beginning state.
- Unknown scores remain unknown until TxLINE score totals appear.

"The replay is bundled and deterministic so judges do not need a live match. The market remains the fixed initial captured snapshot because historical odds movement was not available for this completed fixture."

## 3:20-4:05 - Final Result And Separate Settlement

Let the replay reach the final result: France `0`, Spain `2`.

When the observed `game_finalised` event is reached, show the receipt:

- Final score.
- Original user probabilities.
- Initial TxLINE market probabilities.
- Whether the selected expression occurred.
- `TxLINE data received: yes`.
- `Proof available: no`.
- `Proof structure checked: no`.
- `On-chain validated: no`.

Then show the separately labeled `Simulated execution settlement`:

- Selected outcome.
- Filled stake.
- Weighted-average odds.
- Whether the expression occurred.
- Simulated gross return.
- Simulated profit or loss.

"The result receipt is backed by captured TxLINE score data, including a `game_finalised` event. The simulated settlement is separate and uses only the frozen simulated route. The result is not claimed as proof-validated or on-chain validated."

## 4:05-4:25 - Architecture And Limits

"The architecture keeps raw TxLINE schemas inside `src/lib/txline`, normalizes them into domain types, runs deterministic belief, simulated routing, and replay logic, and renders the UI from those normalized objects. The public demo uses committed sanitized captures and makes no runtime TxLINE API request."

Mention limitations:

- One fixture: France vs Spain.
- One market type: full-match three-way result.
- Fixed initial market during replay.
- Simulated venue liquidity, not real venue data.
- No proof payload identified yet.
- No on-chain validation executed.
- No wagering, wallet, custody, account, or database scope.

## 4:25-4:30 - Close

"The complete loop is market belief, personal belief, disagreement, expression, simulated route, replay, receipt, and simulated settlement. The repository is public, the deployment is separate from MSOS and Autobuilder, and the demo is designed to work even when no live match is available."

Show:

- Public demo: `https://match-horizon.vercel.app`
- Repository: `https://github.com/DanielTabakman/match-horizon`

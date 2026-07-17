# Under-Five-Minute Demo Script

Target length: 4:00 to 4:45.

Public demo URL: https://match-horizon.vercel.app

## 0:00-0:20 - Problem

"A bettor may know what they think will happen, but they still have to translate that belief into a price, compare it with the market, search fragmented liquidity, and split the order. Match Horizon turns a belief into an execution plan and follows it through settlement."

## 0:20-0:50 - Fixture And TxLINE Market Reference

Open the app.

Call out:

- France vs Spain, fixture `18237038`.
- TxLINE market snapshot captured on `2026-07-14T18:42:08.439Z`.
- Three-way match-result probabilities:
  - France `37.272%`
  - Draw `31.837%`
  - Spain `30.893%`

"This is a real captured TxLINE fixture and market snapshot, normalized into a simple three-outcome model. TxLINE gives Match Horizon the sports-market reference and later the match result."

## 0:50-1:35 - User Belief, Disagreement, And Fair Odds

Enter a valid belief that totals `100%`:

- France: `25`
- Draw: `25`
- Spain: `50`

Call out:

- The form requires exactly `100%`.
- The disagreement is `user probability - market probability`.
- Spain becomes the strongest positive disagreement.
- A `50%` belief produces fair decimal odds of `2.00` because fair odds are `1 / probability`.
- Fair odds are the user's theoretical break-even price if their probability estimate is correct.
- TxLINE's Spain probability of `30.893%` corresponds to market-implied decimal odds of about `3.24`.

"I think Spain has a fifty-percent chance, so my fair odds are two-to-one in decimal format: 2.00. The TxLINE market reference is only about thirty-one percent, so Match Horizon identifies Spain as the clearest disagreement."

## 1:35-2:35 - Required Edge, Kelly Sizing, And Simulated Route

Use the default Spain example.

Explain the layers before building the route:

"TxLINE is not the execution venue. It supplies normalized market and result data. The simulated venues here stand in for places where an order could actually be filled: sportsbooks, exchanges, on-chain markets, or private market makers. A real version would connect to those venues, normalize their executable prices and available size, and feed them into this same router."

Call out:

- The panel says `Simulation only - no wager submitted`.
- The required edge defaults to `10%`.
- A `50%` belief produces fair odds of `2.00`.
- A `10%` required edge turns that into calculated minimum odds of `2.20`.
- Strategy bankroll defaults to `$120,000`.
- Half Kelly is selected by default.
- Full Kelly is `8.33%`, applied Half Kelly is `4.17%`, and the suggested stake is `$5,000`.
- Kelly sizing is a simulation reference based on the user's probability, not a guarantee or recommendation.
- Manual stake sizing remains available by disabling `Use Kelly sizing`.
- The simulated liquidity uses generic venue names only.
- Build the route.
- Venue D offers `2.10`, below the calculated `2.20` minimum, so the router rejects it.
- The fills are `$500` at `3.50`, `$2,000` at `3.42`, and `$2,500` at `3.30`.
- Filled stake is `$5,000`.
- Weighted-average odds display as `3.37`.
- Estimated gross payout is `$16,840`.

"The venue quotes and order submission are simulated, but the pricing and routing calculations are real. Match Horizon turns my fifty-percent belief into 2.00 fair odds, adds my ten-percent required edge to get a 2.20 minimum, rejects a venue offering only 2.10, then takes the best eligible prices first until the Half Kelly target is filled."

## 2:35-3:20 - Deterministic Replay

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

When the observed `game_finalised` event is reached, show the TxLINE result receipt:

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

"The result receipt is backed by captured TxLINE score data, including a `game_finalised` event. The simulated settlement is separate and uses only the frozen route. I am not claiming that proof or on-chain validation was completed."

## 4:05-4:35 - Architecture, Future Integration, And Limits

"There are three layers. TxLINE provides the normalized market reference and outcome data. Match Horizon converts belief into fair odds, required edge, fractional Kelly sizing, and a route. Venue connectors would provide real executable prices and liquidity from exchanges, sportsbooks, on-chain markets, or market makers."

Mention limitations:

- One fixture: France vs Spain.
- One market type: full-match three-way result.
- Fixed initial market during replay.
- Venue liquidity and order transmission are simulated.
- No proof payload identified yet.
- No on-chain validation executed.
- No wagering, wallet, custody, account, or database scope.

## 4:35-4:45 - Close

"The complete loop is belief in, execution out: TxLINE market reference, personal belief, fair odds, required edge, Kelly sizing, routed liquidity, deterministic result, and a clear receipt. The router works today over simulated liquidity, and the next step is replacing each simulated venue with a real connector."

Show:

- Public demo: `https://match-horizon.vercel.app`
- Repository: `https://github.com/DanielTabakman/match-horizon`

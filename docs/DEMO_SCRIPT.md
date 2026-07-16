# Under-Five-Minute Demo Script

Target length: 4:00 to 4:45.

Public demo URL: https://match-horizon.vercel.app

## Core Teaching Arc

The demo should teach one transferable sequence:

```text
probability -> fair price -> disagreement -> executable price -> settlement
```

Sports is the example, but the same reasoning applies to prediction markets, options, insurance, forecasting, and other markets that price uncertain outcomes.

## 0:00-0:25 - Problem And Market Principle

"Markets do something powerful: they turn uncertainty into prices. But having a prediction is not enough. A useful decision requires translating your belief into a fair price, comparing it with the market, and then finding out whether you can actually execute at an acceptable price. Match Horizon demonstrates that complete loop."

## 0:25-0:50 - Fixture And TxLINE Market Reference

Open the app.

Call out:

- France vs Spain, fixture `18237038`.
- TxLINE market snapshot captured on `2026-07-14T18:42:08.439Z`.
- Three-way match-result probabilities:
  - France `37.272%`
  - Draw `31.837%`
  - Spain `30.893%`

"This is a real captured TxLINE fixture and market snapshot, normalized into a simple three-outcome model. The market probabilities are a reference point: a compact expression of what the market currently implies about the possible outcomes."

## 0:50-1:35 - Belief, Fair Odds, And Disagreement

Enter a valid belief that totals `100%`:

- France: `25`
- Draw: `25`
- Spain: `50`

Call out:

- The form requires exactly `100%` because the three outcomes are mutually exclusive and collectively exhaustive.
- Disagreement is `user probability - market probability`.
- Spain becomes the strongest positive disagreement.
- A `50%` belief produces fair decimal odds of `2.00` because fair odds are `1 / probability`.
- Fair odds are the user's theoretical break-even price if their estimate is correct.
- TxLINE's Spain probability of `30.893%` corresponds to market-implied decimal odds of about `3.24`.

"I think Spain has a fifty-percent chance, so my fair decimal odds are 2.00. The TxLINE market reference implies only about thirty-one percent. That difference is the potential edge. The important lesson is that being right about an outcome is not enough; opportunity exists only when your probability differs meaningfully from the price available in the market."

## 1:35-2:35 - From Theoretical Edge To Executable Edge

Use the default Spain example.

Explain the layers before building the route:

"TxLINE supplies normalized market and result data. It is not the execution venue. The simulated venues here stand in for sportsbooks, exchanges, on-chain markets, or private market makers that would provide executable prices and available size."

Call out:

- The panel says `Simulation only - no wager submitted`.
- Requested stake defaults to `$5,000`.
- Minimum decimal odds defaults to `3.30`.
- Fair odds and minimum odds answer different questions:
  - `2.00` is the user's theoretical break-even estimate.
  - `3.30` is the worst execution price the user will accept.
- The simulated liquidity uses generic venue names only.
- Build the route.
- The quote at `3.24` is rejected because it is below the minimum.
- The fills are `$500` at `3.50`, `$2,000` at `3.42`, and `$2,500` at `3.30`.
- Filled stake is `$5,000`.
- Weighted-average odds display as `3.37`.
- Estimated gross payout is `$16,840`.

"A theoretical edge is not yet an executable edge. The price may be too low, or there may not be enough liquidity at the best quote. The router filters unacceptable prices, takes the best price first, and splits the order until the requested amount is filled. The venues and submission are simulated, but the routing algorithm and calculations are real and deterministic."

## 2:35-3:20 - Deterministic Replay And Decision Integrity

Start the replay.

Show only enough controls to demonstrate reproducibility:

- Start or Play.
- Pause.
- Resume at `4x`.
- Restart only if time permits.
- Unknown scores remain unknown until TxLINE score totals appear.

"When replay begins, the user's belief and route are frozen. That matters because a past decision should be evaluated using the information and plan that existed at the time, not rewritten after the outcome is known. The replay is bundled and deterministic so judges do not need a live match. Historical odds movement was not available for this completed fixture, so the real initial market snapshot remains fixed while the observed score events advance."

## 3:20-4:05 - Result, Settlement, And Receipt

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

"The TxLINE result receipt records what happened. The simulated settlement applies that result to the route that was frozen earlier. Keeping them separate preserves the truth boundary: the score data is real captured TxLINE data, while venue liquidity and execution are simulated. I am not claiming proof validation or on-chain validation was completed."

## 4:05-4:35 - Why The Pattern Generalizes

"Although this example uses a football match, the reasoning is general. Options traders compare their expected distribution with implied volatility. Prediction-market traders compare personal probability with contract price. Insurers compare estimated risk with premium. In each case, the workflow is the same: form a belief, translate it into a fair price, compare it with the market, test whether the edge can be executed, and preserve the decision through settlement."

"There are three layers here. TxLINE provides the market reference and outcome data. Match Horizon converts belief into fair odds and identifies disagreement. Venue connectors would provide real executable prices and liquidity to the router."

Mention limitations briefly:

- One fixture and one full-match three-way market.
- Fixed initial market during replay.
- Venue liquidity and order transmission are simulated.
- No proof payload or on-chain validation completed.
- No wagering, wallet, custody, account, or database scope.

## 4:35-4:45 - Close

"The complete loop is belief in, execution out: probability, fair price, disagreement, routed liquidity, and a clear result receipt. The router works today over simulated liquidity, and the next step is replacing each simulated venue with a real connector."

Show:

- Public demo: `https://match-horizon.vercel.app`
- Repository: `https://github.com/DanielTabakman/match-horizon`

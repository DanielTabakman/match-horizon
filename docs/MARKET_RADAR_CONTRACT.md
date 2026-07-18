# Market Radar Contract

## Normalized liquidity unit

`ExternalMarketObservation.availableBidSize` and `availableAskSize` are executable top-of-book notional in USD/USDC at the displayed probability.

- SX Bet raw USDC token amounts use 6 decimals. Remaining maker stake is `totalBetSize - fillAmount - pendingFillAmount`; ask-side taker liquidity is converted from maker stake using the maker probability and complementary taker probability.
- Polymarket CLOB level `size` is a share count. Top-of-book notional is `price * size`.
- Gamma `liquidityNum` is not used as top bid or top ask depth when the CLOB book is unavailable.

This lets liquidity scoring and minimum-depth gates compare the same unit across connectors.

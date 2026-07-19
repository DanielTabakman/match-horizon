# Issue #38 Real Venue Witness

Reviewed at: 2026-07-19T03:00:00.000Z

Official Kalshi docs checked:

- `https://docs.kalshi.com/getting_started/quick_start_market_data`
- `https://docs.kalshi.com/api-reference/market/get-market-orderbook`
- `https://docs.kalshi.com/getting_started/orderbook_responses`
- `https://docs.kalshi.com/getting_started/api_environments`

Kalshi production base used:

- `https://external-api.kalshi.com/trade-api/v2`

Live probes used:

- Kalshi `GET /markets?limit=100&status=open&event_ticker=KXMENWORLDCUP-26`
- Kalshi `GET /markets/KXMENWORLDCUP-26-AR`
- Kalshi `GET /markets/KXMENWORLDCUP-26-AR/orderbook`
- SX Bet `GET https://api.sx.bet/markets/active?onlyMainLine=true`
- SX Bet `GET https://api.sx.bet/markets/find?marketHashes=0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1`
- SX Bet `GET https://api.sx.bet/orders?marketHashes=0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1&perPage=50`
- Polymarket `GET https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10&tag_slug=sports`

## Normal-Completion Comparable Group

Canonical selection: `fifa-world-cup-2026-winner:argentina`

| Venue | Market ID | Outcome ID | Title | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| SX Bet | `0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1` | `outcome-one` | Argentina vs The Field - Outrights - World Cup | normal-completion-comparable | Argentina to win World Cup outright; SX Bet exposes NO_GAME void handling. |
| Kalshi | `KXMENWORLDCUP-26-AR` | `yes` | Will the Argentina win the 2026 Men's World Cup? | normal-completion-comparable | YES resolves if Argentina wins the 2026 Men's World Cup; exceptional handling is not sufficiently established as settlement-equivalent. |
| Polymarket | `0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f` | `18812649149814341758733697580460697418474693998558159483117100240528657629879` | Will Argentina win the 2026 FIFA World Cup? | normal-completion-comparable | YES resolves according to the national team that wins the 2026 FIFA World Cup; cancellation or non-completion by deadline resolves to Other. |

This group is not mapped to the historical France-Spain TxLINE fixture. It is a current cross-venue selection only.

## Rule Comparison

| Dimension | SX Bet | Kalshi | Polymarket | Conclusion |
| --- | --- | --- | --- | --- |
| Winner semantics | Public market metadata says `Argentina` vs `The Field` in `Outrights - World Cup`. | Rule text: `If Argentina wins the 2026 Men's World Cup, then the market resolves to Yes.` | Description: resolves according to the national team that wins the 2026 FIFA World Cup. | Compatible for the selected winner outcome. |
| Tournament identity | `Soccer`, `Outrights - World Cup`, event `argentina:the-field`. | Event ticker `KXMENWORLDCUP-26`; descriptive FIFA/World Cup references in title and rules. | 2026 FIFA World Cup winner event. | Compatible. |
| Time horizon | `gameTime` is 2026-07-22T12:00:00Z in the public SX payload. | `expected_expiration_time` is 2026-07-19T14:00:00Z; `early_close_condition` says the market closes after a title holder is declared. | `endDate` is 2026-07-20T00:00:00Z. | Compatible for the tournament-winner horizon. |
| Market close vs technical expiration | Public SX payload exposes active status and `NO_GAME` void label, but no separate technical expiration text. | `close_time` / `expiration_time` are 2028-07-18T14:00:00Z, while `expected_expiration_time` is 2026-07-19T14:00:00Z. | Market end date is 2026-07-20T00:00:00Z. | Kalshi's 2028 fields are technical/latest expiration bounds; the event horizon is the 2026 title-holder declaration. |
| Cancellation / abandonment / not completed | Public SX payload exposes `outcomeVoidName: NO_GAME`; public review indicates NO_GAME voids/returns wagers. | Public market text reviewed here does not sufficiently establish cancellation/abandonment/deadline treatment. | If canceled or not completed by 2026-10-13 23:59, resolves to Other. | Not settlement-equivalent on public evidence. |
| Resolution source | Public SX payload does not include a narrative resolution source. | Kalshi market rules and event ticker are the public source. | FIFA official information, with credible reporting fallback. | Comparable for normal completion only; source differences are surfaced as provenance. |

Final conclusion: use `equivalence=normal-completion-comparable` for the Argentina group. Do not call it settlement-exact or fully fungible liquidity. The app may show a normal-completion paper route, but it must visibly warn that exceptional cancellation, abandonment, or deadline handling may differ by venue.

## Rejected Candidates

| Venue | Market ID | Outcome ID | Title | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| SX Bet | `0xd3fa7bceaaccd813858b5b7ff33a2fba93cc7f05a583883719b9367cc94c10f4` | `outcome-one` | Spain vs The Field - Outrights - World Cup | related | Related to Spain tournament winner, not France-Spain match result. |
| Kalshi | `KXWCBTTS-26JUL19ESPARG-BTTS` | `yes` | Reg Time: Both Teams To Score | not-equivalent | Match prop, not tournament winner. |
| Polymarket | `0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f` | NO token | Argentina does not win | not-equivalent | Complement side must not group with YES. |

## Kalshi Normalization Evidence

Kalshi order books expose YES and NO bids. The app derives executable asks by complement:

- YES ask = `1 - best NO bid`
- YES ask quantity = quantity at best NO bid
- YES ask dollar notional = YES ask probability times that quantity
- NO ask = `1 - best YES bid`
- NO ask quantity = quantity at best YES bid
- NO ask dollar notional = NO ask probability times that quantity

Sanitized raw fixture:

- `test-fixtures/market-radar/kalshi-raw-sanitized.json`

Normalized fallback fixture:

- `test-fixtures/market-radar/kalshi-observations.json`

Captured Argentina example:

- Best YES bid: `0.4170` for `30349.19` contracts
- Best NO bid: `0.5820` for `441520.80` contracts
- Derived YES ask: `0.4180`
- Derived YES ask notional: `$184555.69`
- Derived NO ask: `0.5830`
- Derived NO ask notional: `$17693.58`

## Product Boundary

Visible label:

`Real read-only quotes · paper execution only`

Real:

- venue identity
- market and outcome identifiers
- observed timestamp
- executable ask
- executable top-of-book dollar notional
- audited mapping
- deterministic routing calculation

Simulated:

- order transmission
- fills
- custody
- settlement money

No live wager is submitted.

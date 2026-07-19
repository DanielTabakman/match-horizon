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
- Kalshi `GET /markets/KXMENWORLDCUP-26-AR/orderbook`
- SX Bet `GET https://api.sx.bet/markets/active?onlyMainLine=true`
- Polymarket `GET https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10&tag_slug=sports`

## Exact Group

Canonical selection: `fifa-world-cup-2026-winner:argentina`

| Venue | Market ID | Outcome ID | Title | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| SX Bet | `0x5bce8280a141889cca30944efc700d9f7a594db4e1e390d93d1d9eb8f4226bf1` | `outcome-one` | Argentina vs The Field - Outrights - World Cup | exact | Argentina to win World Cup outright. |
| Kalshi | `KXMENWORLDCUP-26-AR` | `yes` | Will the Argentina win the 2026 Men's World Cup? | exact | YES resolves if Argentina wins the 2026 Men's World Cup. |
| Polymarket | `0x0c4cd2055d6ea89354ffddc55d6dbcef9355748112ea952fc925f3db6a5c457f` | `18812649149814341758733697580460697418474693998558159483117100240528657629879` | Will Argentina win the 2026 FIFA World Cup? | exact | YES resolves according to the national team that wins the 2026 FIFA World Cup. |

This group is not mapped to the historical France-Spain TxLINE fixture. It is a current cross-venue selection only.

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

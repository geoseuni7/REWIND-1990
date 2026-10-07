# TIME & MONEY final total QA

- GitHub/Render image delivery: background assets embedded in HTML; server static asset route added for `/images/*`.
- Letterbox/background overlay opacity reduced so scene remains visible.
- General investment history: all listed assets recorded monthly up to 444 points.
- General graph: average buy line + buy/sell markers retained.
- Online graph: every asset recorded every 6-month turn, 72 points max; buy/sell markers and average buy line retained.
- Scalp market: isolated in `S.trade.prices` / `seedPrices`; no writes to `S.prices`.
- 2000~2026 character system: separate fixed mapping from 1990~1999; no random face selection.
- Online battle client: separate S2 state, 6-month turns, 150s timer, ready/force-progress, common market, independent holdings, online news/events, character updates.
- Server source: server(4)(3) baseline with 15% day-battle chance, 30s timer, 100 hidden tokens, +50% winner reward, 5-minute empty-room cleanup.
- Start menu/mode-entry UI: not intentionally modified.

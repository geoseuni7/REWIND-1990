# V22 FINAL QA

- 729 assets preserved: PASS
- category counts 300/300/10/50/8/6/5/50: PASS
- asset ID duplicates: 0
- historical ticker duplicates: 0
- month-aware listing gate: PASS
- history confidence returned by API: PASS
- missing historical API data falls back to deterministic game-logic path: PASS
- exact start-month metadata: 10 assets
- general start UI structure retained: PASS (not intentionally modified)
- general scalp guard retained: PASS
- online 30-second/100-token/50%-reward text retained: PASS
- online leaderboard character images: removed; names + net worth only
- server syntax: PASS
- browser JS syntax: PASS
- npm test: PASS
- server root smoke test: HTTP 200
- /api/historical smoke test without external data: HTTP 404 with explicit no-real-data response (expected in this offline QA runtime)

## A-grade limitation
No A-grade full-data claim is made. This runtime has no EODHD/Alpha Vantage/FMP keys and no CRSP/WRDS/Norgate licensed import. Therefore the actual monthly price series for all 729 assets cannot be truthfully labeled A here. The game now records source quality when real data arrives and visibly distinguishes A/B/C/game-logic fallback.

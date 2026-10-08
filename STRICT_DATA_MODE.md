# TIME & MONEY — Strict Historical Data Mode

This build deliberately refuses to invent market prices.

## Rules
- No synthetic/random historical price path.
- No base-price fallback.
- No forward-fill/back-fill for missing months.
- No interpolated anchor history.
- No event/sector shock overlay on market prices.
- A trade requires an actual source-backed observation for the exact game month.
- Missing observation => unavailable / not tradable.
- `verifiedDataStart` and `verifiedDataEnd` are derived from actual loaded observations.

## Runtime
The server retrieves monthly observations from the configured historical provider and exposes:
- `GET /api/market/assets`
- `GET /api/market/status`
- `GET /api/market/price?id=...&date=YYYY-MM`
- `GET /api/market/history?id=...&start=YYYY-MM&end=YYYY-MM`
- `POST /api/data/sync`

Yahoo Finance is used here as a public fallback provider. This does **not** claim CRSP/KRX licensed coverage. For production-grade US/Korean history, connect the licensed CRSP/KRX gateways and keep the same validation contract.

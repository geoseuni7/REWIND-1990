# TIME & MONEY — Strict Real-Data Build

This build fixes the market-price corruption caused by synthetic historical pricing.

### What changed
- Market prices come only from source-backed historical observations.
- No sine-wave/random historical path.
- No base-price fallback.
- No forward-fill/back-fill/interpolation for missing months.
- No sector/event price overlay.
- Missing exact-month observation means no price and no trade.
- Legacy synthetic price state is purged on the first strict-engine load.
- General and Online use the same historical-price contract.
- Online starts at 1993-01.

### Data provider
The public runtime fallback is Yahoo Finance monthly historical data. This is a provider connection, not a claim that CRSP/KRX licensed data are included. For production-grade US/Korean history, supply the appropriate licensed source through the same validation contract.

### Important
An asset showing unavailable data is intentional when the provider has no verified observation for that exact game month. It must not be replaced with a fake value.

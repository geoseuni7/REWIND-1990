TIME & MONEY — multi-source historical build

1) Render runs the build command in render.yaml.
2) FinanceDataReader is installed first.
3) npm run build-data builds data/monthly_prices.json from real observed data.
4) Yahoo Finance is NOT used.
5) Optional API fallbacks:
   TIINGO_API_TOKEN
   EODHD_API_TOKEN
   ALPHA_VANTAGE_API_KEY
6) npm test validates the bundle and strict no-synthetic-price rules.
7) Runtime reads the bundled historical store; it does not fetch market prices from the browser or Yahoo.

If no provider can return an observation for an asset/month, that month is unavailable and cannot be traded.

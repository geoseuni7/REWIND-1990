# 1993 Global Universe — actual-data promotion policy

The candidate catalog is discovery only. An asset is promoted into `data/assets/registry.json` only after a real historical price response is received and validated.

## Promotion rule

1. Fetch actual observations from the declared provider order.
2. Validate date, positive close, optional OHLC positivity, numeric values, sorting and duplicate dates.
3. Compute `verifiedDataStart` from the first actual valid observation.
4. Promote only when `verifiedDataStart <= 1993-12-31`.
5. Write the exact validated rows to `data/prices/`.
6. Regenerate `registry.json` **only from promoted rows**. Placeholder/source-date-only assets are never copied into the live registry.

`verifiedDataStart` is never inferred from IPO/listing/inception/first-trade dates.

## Provider strategy

- FinanceDataReader is preferred where installed, especially for KRX/global market symbols and delisted equities.
- Yahoo Finance Chart is a broad fallback for assets carrying `yahooSymbol`.
- Runtime gateways may still use licensed CRSP/KRX/EODHD/Tiingo/Stooq/other sources.
- Provider failures are isolated per asset and recorded in `data/runtime-1993-scan/manifest.json`.

## Important distinction

A source that confirms an instrument existed in 1993 is not enough to promote it. A real price observation is required.

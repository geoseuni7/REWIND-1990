# Runtime real-data acquisition

The game server can fetch verified-source observations directly and cache them under `data/runtime-cache/`.

## Environment

- `ALPHAVANTAGE_API_KEY` — optional equity/ETF provider adapter.
- `FRED_API_KEY` — FRED macroeconomic provider adapter.
- `DATA_FETCH_TIMEOUT_MS` — optional request timeout, default 15000.
- `DATA_CACHE_DIR` — optional cache directory, default `data/runtime-cache`.

## API

- `GET /api/market/assets` — registry used by the client.
- `GET /api/market/status` — loaded/range/provider status.
- `GET /api/market/price?id=ASSET_ID&date=YYYY-MM` — one verified observation.
- `GET /api/market/history?id=ASSET_ID&start=YYYY-MM&end=YYYY-MM` — verified history.
- `POST /api/data/sync` body `{"assetIds":["..."],"force":false}` — fetch and validate remote data.

## Hard rules

1. Remote data must contain positive numeric observations.
2. Dates are sorted and duplicate dates are collapsed deterministically.
3. Provider history must begin no later than `verifiedDataStart`.
4. Provider history must not extend beyond `verifiedDataEnd`.
5. Failed fetch/validation never creates fallback prices.
6. Market, General and Online use the same server runtime/cache.

Alpha Vantage provides daily global-equity time series and monthly series through its documented API, but coverage/entitlement varies by endpoint; the runtime therefore rejects a provider response that cannot cover the asset's required verified start. FRED's observations endpoint is used for configured macro series.

## Licensed / exchange gateway adapter

For KRX/CRSP or another licensed source, do not scrape the provider in the browser. Expose the licensed source through a server-side HTTPS JSON endpoint and configure an asset with `remoteProvider: "generic-json"`, `remoteUrlEnv`, and optionally `remoteHeadersEnv`. The endpoint may return either an array of rows or `{ "rows": [...] }`. The same validation gate applies before Market accepts the data.


## Stock production gateways

Set a stock asset's `remoteProvider` to `crsp-gateway` or `krx-gateway` and set `remoteUrlEnv` to the environment variable containing the gateway endpoint. The gateway must return `rows` plus `verifiedDataStart`.

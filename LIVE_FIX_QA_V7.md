# TIME & MONEY V7 QA

## Fixed
- Bundled historical IDs such as `US:AAPL` are resolved from runtime asset IDs such as `AAPL`.
- General investment selection now renders immediately before remote historical fetch, preventing mobile tap from appearing dead during a slow request.
- Online investment selection now renders immediately and then loads history.
- Real-estate assets no longer borrow unrelated REIT prices.
- Real-estate historical requests with `molit-apt` route to the actual MOLIT provider.
- Real-estate names remain the named Korean properties in `PROPERTIES`.

## Executed tests
- `node --check server.js`: PASS
- inline JavaScript extracted from `index.html` + `node --check`: PASS
- `/api/historical?id=AAPL&kind=over&ticker=AAPL`: PASS, bundled 1993 monthly rows returned.
- Online room: create -> join -> start: PASS.
- Online AAPL buy in 1993-01: PASS, 1 share at 0.44 from bundled historical data.
- Real-estate API without `MOLIT_SERVICE_KEY`: correctly returns unavailable; no synthetic price created.

## Important limitation
The runtime cannot honestly claim all 1,025 assets have verified historical observations. Only assets with actual bundled or provider-returned observations can trade. The rest must remain unavailable until actual data is obtained.

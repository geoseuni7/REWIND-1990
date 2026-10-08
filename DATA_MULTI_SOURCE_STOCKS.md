# Multi-source stock ingestion

The stock runtime accepts real observations from multiple providers. Provider order is per asset:

1. `crsp-gateway` / `krx-gateway` — preferred licensed/source-of-record gateways.
2. `yahoo-finance` — broad public historical fallback; actual first observation is verified per symbol.
3. `eodhd` — deep EOD history where licensed access is configured.
4. `tiingo` — long-history EOD feed where configured.
5. `stooq` — CSV historical feed; subject to Stooq licence/use restrictions.
6. `alpha-vantage` — fallback only; current documented history is not assumed to reach 1993.

Environment variables:

- `EODHD_API_KEY`
- `TIINGO_API_KEY`
- `ALPHAVANTAGE_API_KEY`
- existing `FRED_API_KEY`

No API key means that provider is skipped/fails and the next configured provider is attempted. The runtime never substitutes a synthetic series.

For every successful provider response the validator requires:

- at least one positive numeric observation;
- valid dates;
- chronological de-duplication;
- provider-declared `verifiedDataStart` equal to the first actual observation;
- optional `verifiedDataEnd` respected;
- no interpolation or missing-date fabrication.

A source claiming history from 1993 does not make every symbol start in 1993. The actual first observation for each instrument becomes its lifecycle start.


## Python extraction adapters

The project also accepts offline CSV/JSON material produced by Python collectors:

- `FinanceDataReader`: use `fdr.StockListing(...)` for universe discovery and `fdr.DataReader(...)` for price extraction. Its documented KRX example currently demonstrates historical coverage from 1995-05-02 for `KRX:000100`; the collector must therefore inspect the returned first row rather than assume 1975/1993.
- `pykrx`: use `stock.get_market_ohlcv(fromdate, todate, ticker)` for KRX OHLCV. Returned rows are source observations and pass through the same validator.
- `yfinance`: optional Python collector for Yahoo Finance. Yahoo data must be treated as source data subject to Yahoo's terms; the collector records the actual first/last returned observation.

These Python collectors do not bypass validation. They are ingestion methods, not proof that an asset has 1993 history.

## 1993 historical-universe expansion

The project now defines a hard historical-universe gate:

- `historicalEligibilityDate = 1993-01-01`.
- A security is eligible for the 1993 universe only if its **first actual returned observation** is on or before that date.
- The rule is applied to both currently listed and delisted KRX securities.
- FinanceDataReader's documented `KRX-DELISTING` interface can return delisted-security price history from listing through delisting, so it is used as an ingestion/discovery path rather than assuming that the current ticker list is complete. citeturn0search2turn0search5
- KRX Data Marketplace is treated as the official Korean source layer. It exposes stock/index statistics and downloadable datasets, while individual API/product coverage must be checked per dataset. citeturn1search0turn1search2
- The KRX public API's documented "유가증권 일별매매정보" endpoint currently states coverage from 2010-01-04, so that endpoint is **not** used as proof of 1980s/1990s daily coverage. citeturn1search4
- KOSIS is reserved for market-level/statistical context; it is not treated as a substitute for individual-stock OHLCV. citeturn1search11

The batch collector is `scripts/fdr-krx-universe-download.py`. It creates a manifest and individual JSON files only for symbols whose actual first returned observation passes the 1993 cutoff. No guessed listing date, interpolation, or synthetic row is created.

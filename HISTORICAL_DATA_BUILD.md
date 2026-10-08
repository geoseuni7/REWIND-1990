# Historical data build

Yahoo Finance is not used anywhere in the runtime or build pipeline.

Source priority:
1. FinanceDataReader: KRX / KRX-DELISTING and supported exchange data.
2. Tiingo: only when `TIINGO_API_TOKEN` is configured.
3. EODHD: only when `EODHD_API_TOKEN` is configured.
4. Alpha Vantage: only when `ALPHA_VANTAGE_API_KEY` is configured.

The builder converts observed daily Close values to one value per month: the last actual trading observation in that month. It never interpolates, forward-fills, back-fills, estimates, or creates synthetic prices.

For assets that cannot be verified by any configured source, the asset remains in the game catalog but has no tradable price for those months.

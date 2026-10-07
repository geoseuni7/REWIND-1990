# Multi-source historical QA

- Primary runtime sources: EODHD -> Alpha Vantage -> Financial Modeling Prep -> Stooq -> Yahoo Finance.
- A provider is reported as successful only when it returns a non-empty monthly price series.
- No provider is claimed to have supplied data when its API key is absent or its request fails.
- Missing months are handled by the existing canonical historical bridge logic; these bridged values are not represented as source quotes.
- Delisted EOD data can be obtained from EODHD when configured; EODHD documents delisted symbols and historical EOD retention.
- Alpha Vantage documents monthly and monthly-adjusted historical series with 25+ years of coverage for supported equities.
- FMP historical endpoint supports date ranges; coverage depends on plan/symbol.
- Stooq is attempted as a public fallback; availability depends on symbol coverage and network access.
- Yahoo remains the final remote fallback, not the sole source.
- index.html was not modified in this pass; startup/mode-selection UI is preserved.
- server.js syntax check: PASS.
- No-key/no-network historical request correctly returns "actual monthly data not found" rather than pretending an estimate is source data: PASS.

## Honesty rule
This build does NOT claim 729/729 live-verified historical series unless a runtime verification pass actually returns them. Provider keys and network access are required for live retrieval.

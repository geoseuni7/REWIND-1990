# Multi-source historical data QA

## Source priority
1. EODHD, when `EODHD_API_TOKEN` is configured.
2. Yahoo Finance, as the secondary public-source fallback.
3. Existing verified anchors / deterministic naturalized history only where external data is unavailable.

EODHD supports the Korea Stock Exchange under exchange code `KO`, and its historical API returns monthly bars; it also retains delisted-symbol EOD history.

## Honesty rules
- Never label a series as fully historical merely because a ticker exists.
- A missing period is interpolated only after all configured sources fail to supply it.
- A source and its coverage range are stored in `remoteHistorySource`.
- No CRSP/Norgate data is claimed unless licensed credentials/data are actually supplied.

## Verification
- `node --check server.js`: PASS
- `node --check` extracted index script: PASS
- EODHD integration present: PASS
- Yahoo fallback preserved: PASS
- KRX EODHD mapping (`.KO`) present: PASS
- No startup/menu code intentionally changed: PASS

## Limitation
A true 729/729 external-data verification requires a working data-provider credential/network at runtime. This build therefore does not claim that all 729 assets are already populated with verified external observations in this offline build environment.

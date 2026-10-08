# 1993 Historical Universe Expansion

## Rule

The project does not infer historical eligibility from listing/inception dates. A symbol enters the 1993 historical universe only after a real data adapter returns at least one actual observation dated on or before **1993-12-31**. The exact first returned observation becomes `verifiedDataStart`.

This deliberately allows instruments that began during 1993 (for example SPY, whose official inception/listing date is 1993-01-22) while preventing later instruments from being backfilled. State Street confirms SPY inception/listing on 1993-01-22.

## Markets scanned

- US: NYSE/NASDAQ/AMEX candidates and major indices
- Korea: KRX current + KRX-DELISTING
- Japan: TSE
- UK: LSE/Yahoo symbols
- Germany: Xetra/Yahoo symbols
- Hong Kong: HKEX
- China: SSE/SZSE
- Major indices
- ETFs
- Futures: metals, energy, agriculture, FX futures
- FX
- Spot gold/silver candidates

FinanceDataReader documents support for KRX, KRX-DELISTING, NASDAQ, NYSE, AMEX, SSE, SZSE, HKEX, TSE, ETFs, indices, FX and futures. It also documents Ford data from 1980 and direct exchange-qualified historical queries.

## Confirmed instrument dates vs price observations

An official first-trade/inception date is useful metadata but **does not by itself create a price series**. CME confirms historical first trading dates for gold, silver and copper futures; BIS provides long daily bilateral FX series; these are recorded as source-confirmed instrument candidates, but actual price rows are still required before production activation.

## Runtime command

```bash
python scripts/scan-1993-universe.py data/runtime-1993-scan
```

The result is `manifest.json`. Only rows with `verifiedDataStart <= 1993-12-31` are eligible.

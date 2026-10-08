# TIME & MONEY — real-data replacement policy

1. A symbol is never replaced by an unrelated company merely to make a chart work.
2. Provider-specific aliases for the same instrument are allowed:
   - KRX → `KRX:<symbol>` → `KRX-DELISTING:<symbol>`
   - Japan → `TSE:<symbol>`
   - Hong Kong → `HKEX:<symbol>`
   - China → `SSE:<symbol>` or `SZSE:<symbol>` according to code
   - UK/Germany → provider-qualified symbol first, then plain symbol
   - US equities/funds → Stooq `<ticker>.us`
   - supported futures → Stooq/FDR contract alias
3. If no actual observations are returned for the complete game window, the asset is marked `NO_DATA` and is not tradable.
4. No interpolation, forward-fill, synthetic price, guessed listing date, or proxy-company substitution is permitted.
5. A replacement means a working identifier for the same real instrument/provider, not a fabricated substitute.
6. Bundled data has priority over runtime data.

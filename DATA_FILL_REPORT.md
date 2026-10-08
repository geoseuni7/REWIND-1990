# DATA FILL REPORT V4

- Game registry: 1,025 assets.
- Bundled verified historical assets: 20.
- Bundled verified monthly observations: 166.
- All 1,025 assets now have a provider ticker/identifier for runtime verification.
- US equities/funds/REIT-like instruments: Stooq runtime path.
- KRX/global/crypto/derivatives/bonds: FinanceDataReader collector path.
- No synthetic prices are written.
- Missing months remain missing and are non-tradable.
- Provider alias replacement is same-instrument only.

Local end-to-end QA performed:
- 1,025 assets served by `/api/market/assets`.
- 1993-01 actual bundled prices verified for AAPL, MSFT, KO, GE, JNJ, XOM, PG, JPM, BAC.
- 1993-01 server-authoritative buy of 1 AAPL succeeded at 0.44.
- Six-month online turn and 150-second timer logic retained.

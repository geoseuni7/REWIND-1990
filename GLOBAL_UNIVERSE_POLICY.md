# Global Universe Policy v1.3

- Candidate discovery uses every currently documented FinanceDataReader listing endpoint supported by this build: KRX/KOSPI/KOSDAQ/KONEX, KRX-DELISTING, KRX-ADMINISTRATIVE, KRX-MARCAP, KRX-DESC/KOSPI-DESC/KOSDAQ-DESC/KONEX-DESC, NASDAQ, NYSE, AMEX, S&P500, SSE, SZSE, HKEX, TSE, HOSE.
- Candidate discovery is not verification.
- An asset is promoted only when actual historical rows are fetched and pass validation.
- Eligibility is any overlap with 1993-01-01 through 2026-12-31: first_observation <= 2026-12-31 AND last_observation >= 1993-01-01.
- Assets beginning after 1993 are eligible; assets ending before 1993 are not.
- No interpolation, forward-fill, synthetic rows, inferred listing dates, or metadata-only promotion.
- Foreign numeric symbols are queried with their explicit FDR exchange to prevent cross-market code collisions.
- Registry is regenerated only from promoted actual observations.
- Offline provider failures are recorded as failures; they are never treated as verified.

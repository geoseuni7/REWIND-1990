# Real historical data runtime

The server first uses `monthly_prices.json`. If no bundled verified history exists, US equities/US-listed funds are fetched from Stooq daily observations and aggregated to month-end close. No interpolation, forward-fill, synthetic price, or guessed listing date is used.

A month is tradable only when an actual observation exists for that month.

The returned history includes the earliest and latest actual observed month. This allows the UI to show the full pre-1993 graph when the source contains it.

CRSP remains the preferred licensed source for production-quality U.S. historical data; Stooq is a fallback runtime source for public verification/testing.

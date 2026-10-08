# Historical data build

The deployment build runs `npm run build-data` before the server starts.

- Source: Yahoo Finance monthly historical observations for the verified manifest.
- Bundle: `data/monthly_prices.json`.
- Only observed monthly Close values are written.
- No interpolation, forward-fill, back-fill, synthetic values, or estimates.
- Assets with no available observation remain absent and are not tradable for that month.
- The build tries the manifest ticker first, then the known market suffix fallback for Korean/crypto assets.

A build with zero successfully retrieved assets fails rather than silently creating fake prices.

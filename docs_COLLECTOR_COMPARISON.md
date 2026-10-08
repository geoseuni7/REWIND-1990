# Collector comparison — user collector vs TIME & MONEY V1.1

## Adopted from the uploaded collector

- FinanceDataReader as a practical public-data collector.
- pandas-based normalization.
- A dedicated validator before storage.
- A writer that persists price rows and asset metadata.
- `verifiedDataStart` / `verifiedDataEnd` derived from actual returned rows.

## Improvements retained from TIME & MONEY

- 156-asset candidate catalog instead of a hard-coded 9-stock list.
- Candidate registry is separate from the live registry.
- `1993-12-31` cutoff is enforced using the first actual valid observation.
- Listing date / inception / first-trade date cannot promote an asset.
- FDR → Yahoo fallback is isolated per asset.
- Duplicate dates are deterministic; invalid/zero-price rows are discarded without interpolation.
- Provider attempts and failures are recorded in the scan manifest.
- The live registry is regenerated **only from promoted price rows**; existing placeholders are not carried forward.
- `adjClose` is retained when the source supplies it, while raw OHLC remains available.
- Parallel scanning prevents one dead provider from serially blocking the whole 156-asset universe.

## Important problems in the uploaded collector that were not copied

1. It hard-codes only 9 symbols, so it cannot scan the 156-asset catalog.
2. It does not enforce the 1993 cutoff before writing an asset as tradable.
3. It marks every successfully returned asset `tradable=True` even when its first observation is after 1993.
4. It writes directly into the live registry, rather than candidate → verified promotion.
5. It has no provider fallback when FDR fails for a symbol.
6. It does not retain provider-attempt provenance in the stored asset.
7. It does not preserve adjusted close.
8. It can silently turn a source result into a live asset without an independent promotion gate.

The uploaded collector was therefore used as an implementation reference, not as the final gate.

# TIME & MONEY — Reality-first data policy

## Production rule
No fabricated historical price path. No guessed listing date. No silent interpolation. An asset becomes tradable only when its verified historical observations are actually loaded.

`verifiedDataStart` means the first date for which the production dataset can prove the asset's usable history, not an inferred IPO/listing date.

## Source hierarchy
1. Primary exchange / official market operator
2. Research-grade historical dataset with corporate actions and delistings
3. Official central-bank / government statistical source
4. Secondary source only when independently reconciled
5. If unresolved: exclude asset

## Current primary-source map
- US equities: CRSP
- Korea: KRX
- Futures: CME historical product records + contract history
- FX: BIS bilateral exchange rates
- Macro: FRED / OECD source series

## Important
The current build contains verified lifecycle metadata and engine scaffolding, but it does not pretend that missing price observations exist. Production price files must be imported before those assets are enabled for trading.

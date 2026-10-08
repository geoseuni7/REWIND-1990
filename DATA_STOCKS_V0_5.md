# Stock data integration

## Source rule
US stocks: CRSP is the preferred production source because it covers active and inactive securities, corporate actions, delistings and permanent identifiers.

Korean stocks: KRX is the preferred production source. KRX Open API currently documents stock daily trading data from 2010 onward, so it is not sufficient by itself for the game's 1993 common start. For 1993-era Korean equities, connect a licensed KRX historical data feed/gateway that returns the required history.

## Gateway response contract

`crsp-gateway` and `krx-gateway` must return:

```json
{
  "sourceUrl": "https://...",
  "verifiedDataStart": "1993-01-04",
  "verifiedDataEnd": "2026-09-30",
  "rows": [
    {"date":"1993-01-04","open":1,"high":1,"low":1,"close":1,"adjClose":1,"volume":1}
  ]
}
```

`verifiedDataStart` is supplied by the gateway from the actual source dataset. It is not inferred from an IPO/listing date.

The game server rejects:
- missing `verifiedDataStart`
- history beginning after the registry requirement
- non-positive/non-numeric observations
- malformed dates
- data beyond the declared registry end

No interpolation or synthetic fallback is permitted.

## Lifecycle rule (V0.6 correction)

`verifiedDataStart` is now required to equal the first actual observation returned by the provider. The common game start (`1993-01`) is never substituted for an asset lifecycle date.

If an asset's actual verified history begins later than 1993-01, the asset becomes tradable only from that later verified start.


## V0.6 data-state correction

Until a provider has actually supplied and validated price observations, registry entries use `verifiedDataStart: "pending"`. The game start month `1993-01` remains a gameplay constant, not an asset lifecycle date.

## Multi-source stock fallback (V0.7 preparation)

When the preferred licensed gateway is unavailable, the runtime may use configured real-data providers in this order:
1. CRSP / KRX gateway
2. EODHD
3. Tiingo EOD
4. Stooq CSV
5. Alpha Vantage

A fallback is accepted only when it returns actual observations and passes the same validation. `verifiedDataStart` is always taken from the first returned observation. No source is allowed to manufacture missing dates.

Licensing matters: Stooq and other providers may restrict redistribution/commercial use. The runtime therefore treats provider access as a deployment configuration rather than embedding a copied proprietary database into the repository.

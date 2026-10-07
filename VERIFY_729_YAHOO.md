# 729 Yahoo historical verification

Run `POST /api/historical/verify-all` with `HISTORICAL_729_VERIFY_MANIFEST.json` on a network-enabled deployment. Each row must return `ok:true` and `months>0`. This environment cannot reach query1.finance.yahoo.com directly, so no false pass is claimed.

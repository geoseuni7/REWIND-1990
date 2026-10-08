# TIME & MONEY 배포 파일

GitHub에는 이 ZIP을 그대로 폴더로 올리지 말고, 압축을 풀어 **모든 파일을 같은 루트**에 올린다.

필수 런타임 파일:
- index.html
- server.js
- session2_assets.json
- monthly_prices.json

중요:
- `TIME_MONEY_LIVE_CRITICAL_FIX.zip`의 index.html/server.js만 올리면 서버가 필요한 JSON을 찾지 못해 정상 부팅할 수 없다.
- 실제 가격이 없는 월은 거래하지 않는다.
- KRX 실시간/과거 전체 데이터는 2026-09 이후 KRX 인증 정책 때문에 별도 인증 provider가 필요할 수 있다.
- API 키/비밀번호는 GitHub에 올리지 않는다.

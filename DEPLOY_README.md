# TIME & MONEY deployment

GitHub root에 ZIP 내부 파일을 그대로 올린다. 폴더 업로드 금지.

필수 Render Environment:
- `MOLIT_SERVICE_KEY`: 국토교통부 실거래가 서비스키. 부동산 거래 데이터를 실제로 조회할 때 필요.
- `OPENAI_API_KEY`: AI 기능을 사용할 경우에만 필요.

이번 빌드의 핵심 수정:
- bundled price IDs such as `US:AAPL` are resolved against runtime IDs such as `AAPL`.
- investment selection renders immediately before remote data loading, so mobile taps are not blocked by a slow provider request.
- real-estate assets keep their named-property identity and never borrow REIT prices.
- real-estate historical requests correctly route to the MOLIT provider.
- no synthetic historical price is created.

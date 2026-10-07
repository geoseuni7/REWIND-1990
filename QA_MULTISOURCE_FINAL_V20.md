# V20 멀티소스 역사 엔진 QA

- index.html은 V19와 동일한 SHA-256인지 비교하여 시작화면/게임 UI 변경 없음 확인
- server.js node --check PASS
- 729 자산 구조 보존
- 기존 EODHD/Alpha Vantage/FMP/Stooq/Yahoo 유지
- Internet Archive Wayback 복구 provider 추가
- CRSP/WRDS/Norgate 등 라이선스 원자료를 HISTORICAL_IMPORT_DIR로 반입하면 동일 엔진에서 검증 가능
- KRX/FinanceDataReader 계열을 위한 외부 반입 경로 지원
- API 키가 없는 공급자를 성공으로 계산하지 않음
- 실제 데이터가 없으면 실데이터로 표시하지 않음

## 실행환경 한계
현재 실행환경에서는 외부 금융 API의 인증키와 CRSP/WRDS/Norgate 라이선스 원자료가 제공되지 않았고, 서버 프로세스의 외부 금융망 접근도 확인되지 않았다. 따라서 이 QA는 729개 A급 확정을 주장하지 않는다.

## 다음 실데이터 검증 조건
배포 서버에서 인증키/라이선스 원자료가 제공되면 /api/historical/verify-all로 각 종목의 출처, 월수, 첫/마지막 월, 교차검증률, 등급을 산출한다.

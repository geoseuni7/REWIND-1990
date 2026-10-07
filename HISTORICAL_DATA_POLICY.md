# TIME & MONEY — 역사 데이터 정책 V20

## 원칙
실제 데이터와 추정 데이터를 절대 같은 것으로 표시하지 않는다.

## 우선순위
1. KRX/FinanceDataReader 계열 국내 원자료 또는 검증된 KRX 수집본
2. CRSP/WRDS/Norgate 등 라이선스 데이터의 로컬 반입본 (HISTORICAL_IMPORT_DIR)
3. EODHD
4. Alpha Vantage
5. Financial Modeling Prep
6. Stooq
7. Internet Archive Wayback Machine의 과거 Yahoo CSV 복구
8. Yahoo Finance

## 교차검증
- 2개 이상의 독립 출처가 최소 12개월 겹치고 90% 이상이 2% 이내, 최대 차이 5% 이내이면 A.
- 실제 출처가 2개 이상이지만 조건 미달이면 B.
- 실제 출처 1개면 C.
- 실제 출처가 없으면 D.
- A만 '교차검증된 실제 역사'로 표현한다.

## 결측 처리
- 실제값 사이: 로그 보간
- 실제 시작 전/후: 시장/자산군 앵커 기반 자연 연결
- 전혀 확인되지 않는 구간: 게임용 추정값으로만 표시

## 교체
D 또는 게임 요구사항을 충족하지 못하는 C/B 종목은 같은 카테고리의 A급 대체 후보가 실제 검증된 경우에만 교체한다.
A급 후보가 실제로 검증되지 않았으면 임의 교체하지 않는다.

## 라이선스 데이터
CRSP/WRDS/Norgate는 라이선스가 필요한 데이터이므로 이 프로젝트가 해당 원자료를 보유하지 않은 상태에서 성공으로 주장하지 않는다. CSV/JSON 월별 데이터를 HISTORICAL_IMPORT_DIR에 넣으면 동일한 교차검증 파이프라인에 참여한다.

## 공개 복구
Wayback은 과거 Yahoo CSV/역사 페이지의 공개 아카이브가 존재할 때만 사용한다. 아카이브가 없으면 실패 처리한다.

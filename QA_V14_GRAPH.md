# V14 Graph QA

## 목적
V13에서 남아 있던 "그래프가 일직선으로 보이는" 문제를 구조적으로 제거.

## 수정
- 게임 초기화 후 전체 투자자산의 월별 역사 경로를 materialize.
- 기존 1점짜리 `investHistory`를 그대로 사용하지 않도록 차트 그리기 직전에 canonical historical path로 재구축.
- `historicalPriceFor()` → `buildSecurityHistory()` 경로를 단일 기준으로 사용.
- 원격 Yahoo 월별 데이터가 있으면 원격 데이터 우선.
- 원격 데이터가 없으면 기존 결정적 비평탄 fallback 경로 사용.
- 1개월/1년/10년/전체 범위는 materialized history에서 각각 최근 구간을 잘라 사용.
- 매수/매도/대출/자산 목록/시작화면 로직은 변경하지 않음.

## 정적 검사
- index.html script 추출 후 `node --check`: PASS
- `initializeAllSecurityHistories()` 호출: 1회 확인
- `investmentChart()` 진입 시 `rebuildInvestmentHistoryFromSource()` 호출: 확인
- `historicalPriceFor()` → `buildSecurityHistory()` 연결: 확인

## 한계
실제 모바일 브라우저에서 화면 픽셀을 직접 확인하는 브라우저 자동화 환경은 현재 제공되지 않아 육안 모바일 PASS는 주장하지 않음.

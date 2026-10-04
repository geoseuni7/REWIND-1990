# TIME & MONEY — 2중 등락률 + 년·월 전환 최종 QA

## 적용 범위
- 일반모드
- Session 2(유저대전모드)

## 변경사항
1. 일반모드 다음 달 진행 시 `YYYY.MM` 전환 화면 표시를 구현.
2. 일반모드 상단 날짜는 기존 `YYYY.MM` 표시 유지 및 다음 달/연도 경계 갱신 확인.
3. Session 2 게임 화면에 현재 `YYYY.MM` 표시 유지.
4. Session 2에서 회차가 실제 변경되면 동일한 `YYYY.MM` 전환 화면 표시.
5. Session 2 서버가 직전 회차 가격(`previousPrices`)을 별도로 전달.
6. Session 2 선택 종목에도 구매가 대비 + 전월 대비 2중 등락률 표시.
7. Session 2 구매가 대비는 개인별 평균매수가, 전월 대비는 공통 서버 전월 가격을 사용.
8. 연도 전환(12월→1월)에서도 직전 12월 가격이 전월 가격으로 유지되도록 처리.

## 검수
- server.js Node syntax: PASS
- index.html embedded script syntax: PASS
- 일반모드 2중 등락률 함수/상세/목록 경로: PASS
- 일반모드 `YYYY.MM` 헤더: PASS
- 일반모드 다음 달 전환 표시 함수/호출: PASS
- Session 2 `YYYY.MM` 표시: PASS
- Session 2 회차 변경 전환 표시: PASS
- Session 2 구매가 대비/전월 대비 함수: PASS
- Session 2 previousPrices 서버 전달: PASS
- 실제 HTTP 대전 테스트: PASS
  - 시작: 1990.01
  - 12회 전원 준비 진행 후: 1991.01
  - 평균매수가 보존 확인
  - 전월 가격 전달 확인
  - 연도 경계 확인

## 실제 통합 테스트 결과
`YEAR_DUAL_INTEGRATION_PASS`
- start: 1990.01
- after 12 advances: 1991.01
- sample asset: 005930
- average purchase: 22420
- previous price at 1991.01: 21871
- current price at 1991.01: 21330

## 보존 확인
- 변경 대상 외 Session 2 동작은 기존 검증본과 동일한 구조를 유지.
- 일반모드의 가격/매수/매도 계산 엔진은 변경하지 않고 표시/전환 표시 경로만 보강.

# TIME & MONEY · Session 2 Final QA

검수 대상: `index.html`, `server.js`, `session2_assets.json`, `package.json`, `package-lock.json`, `render.yaml`

## Pass 1 — 정적/구조 검수
- HTML `<script>` 2개 문법 검사: PASS
- `server.js` 문법 검사: PASS
- Session 2 729개 자산 데이터 JSON: PASS
- 서버가 사용하는 `session2_assets.json` 최종 패키지 포함: PASS
- Session 2 API 계약 9개 확인: PASS
- 참가자 배열을 서버 응답 `players`로 반환: PASS
- polling 500ms + `cache:no-store` 확인: PASS
- 로비 시작 조건은 최소 2명 + 방장: PASS
- 로비 준비 완료 강제 없음: PASS
- 존재하지 않는 `advanceTurn()` 호출 제거: PASS

## Pass 2 — 실제 HTTP 통합 테스트
- 방 생성: PASS
- 참가자 2/3명 입장: PASS
- 다른 참가자 목록 동기화: PASS
- 방장 식별: PASS
- 로비에서 준비 없이 방장 시작: PASS
- 시작 카운트다운 후 1990.01 진입: PASS
- 개인별 투자수량 독립 처리: PASS
- 한 명 준비 → 월 진행 안 됨: PASS
- 전원 준비 → 다음 월 진행: PASS
- 준비 중복 제출 → 중복 진행 방지: PASS
- 방장 퇴장 → 잔류 플레이어 자동 방장 위임: PASS
- 게임 중 방장 퇴장 → 자동 위임: PASS

## Pass 3 — 금융/단타 테스트
- 1금융 대출: PASS
- 사채 대출: PASS
- 매수: PASS
- 매도 및 보유수량 정리: PASS
- 랜덤 단타 공통 종목/가격 동기화: PASS
- 단타 매수: PASS
- 단타 시간 종료 자동 정산: PASS

## 일반모드 보존 검사
`index33_guide_upgrade_removed(2)_Session2.html`의 Session 2 영역 이전 일반모드 prefix와 현재 `index.html`을 비교했습니다.

- `GENERAL_PREFIX_IDENTICAL = TRUE`
- 비교 길이: 104,910 bytes/chars 기준 동일 영역

따라서 이번 수정에서 일반모드 영역에는 변경을 가하지 않았습니다.

## Render 구성
- Node >= 20
- `npm install`
- `npm start`
- `PORT` 환경변수 사용
- `/` health path 제공

## 최종 패키지
- `index.html`
- `server.js`
- `session2_assets.json`
- `package.json`
- `package-lock.json`
- `render.yaml`

### 주의
현재 방/세션 데이터는 서버 메모리에 존재합니다. Render 인스턴스 재시작 또는 다중 인스턴스 확장 시 방 상태가 유지되는 구조는 아닙니다. 단일 Render 인스턴스 기준 Session 2 기능 검수는 완료했습니다.

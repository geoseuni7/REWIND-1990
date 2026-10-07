# V15 ALL QA

## 범위
V14의 보완점 전체 적용: canonical 역사 경로, 이벤트 오버레이와 그래프 동기화, 저장/불러오기 후 역사 복원, 상장 전 거래 차단/역사 시작점, 공통 multiplier·평균매수가 구조 검증, 일반/온라인 액수 슬라이더 제거, 온라인 단타/뉴스 분리 보존.

## 정적 결과
- 투자자산: 729 = 국내 300 + 해외 300 + 코인 10 + ETF/인덱스 50 + 채권 8 + 금/원자재 6 + 파생 5 + 서울 부동산/REIT 50
- exact source replacements: 69
- index script `node --check`: PASS
- server `node --check`: PASS
- canonical history engine: PASS
- load normalization: PASS
- event overlay -> canonical chart synchronization: PASS
- general amount slider removed: PASS
- online amount slider removed: PASS
- general scalp UI inaccessible: PASS
- startup mode selector retained: PASS
- online day trade 15% / 30 sec / hidden 100 tokens / 50% winner reward: source checks PASS

## 데이터 한계
현재 실행 환경에서 Yahoo Finance DNS/네트워크 연결을 보장할 수 없으므로 729개 전부의 실시간 원격 시계열을 PASS라고 주장하지 않는다. 원격 시계열이 있으면 우선 사용하고, 없으면 게임용 결정론적 역사 추정치를 사용한다. UI에는 원격 source가 없을 경우 `게임 내 역사 기준값`으로 표시한다.

## 브라우저 한계
실제 Android Chrome 터치/픽셀 렌더링 자동화는 제공 환경에서 불가하여 모바일 육안 PASS는 별도 확인 대상이다.

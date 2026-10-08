# Render Scan Policy v1.4

## 목적
전세계 후보를 최대한 수집하되, Render 서비스와 데이터 공급원에 과부하를 주지 않고 실제 관측값만 검증한다.

## 기본 제한
- workers: 4
- request delay per provider: 0.50s
- batch size: 50
- request timeout: 8s
- maximum configured workers: 16
- checkpoint after every batch

환경변수로 조절할 수 있다:
`TM_WORKERS`, `TM_REQUEST_DELAY`, `TM_BATCH_SIZE`, `TM_REQUEST_TIMEOUT`.

## 승격 조건
`firstObserved <= 2026-12-31 AND lastObserved >= 1993-01-01`.

가격 행이 없거나 OHLC 검증을 통과하지 못하면 registry에 들어가지 않는다.

## Render 배치 구조
대량 최초 수집은 persistent disk를 가진 Background Worker가 적합하다. Render 문서상 persistent disk는 Background Worker에 붙일 수 있고, 디스크가 붙은 서비스는 여러 인스턴스로 확장할 수 없으므로 파일 기반 checkpoint는 단일 worker가 담당한다.

Cron은 persistent disk에 접근할 수 없으므로 장기 수집에는 사용하지 않는다. 짧은 주기 업데이트는 외부 DB/Object Storage를 사용하는 별도 cron으로 분리한다.

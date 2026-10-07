TIME & MONEY — Render 서버 배포용

1) 이 폴더 전체를 Render Web Service로 배포합니다.
2) Build Command: npm install
3) Start Command: npm start
4) Health Check: /
5) Node: 20 이상

중요
- index.html만 따로 올리지 마세요.
- 온라인 대전은 server.js가 반드시 실행 중이어야 합니다.
- images/ 폴더를 반드시 함께 배포해야 합니다.
- 온라인 배경 3종과 1990/2000 캐릭터 이미지는 모두 /images/...의 동일 서버 경로를 사용합니다.
- 브라우저가 https로 접속하면 이미지/API도 같은 Render https 주소에서 불러옵니다.
- 온라인 API는 상대경로 /api/rooms/*를 사용하므로 별도 API 주소 입력이 필요 없습니다.

Render에서 배포 후 확인
- https://내-서비스주소.onrender.com/  -> 게임 화면
- https://내-서비스주소.onrender.com/images/backgrounds/online_city.svg -> 배경 파일
- 온라인 대전에서 방 생성 -> 참가 -> 방장 시작

주의
- Render Free Web Service는 유휴 시 슬립될 수 있습니다.
- 서버 메모리의 온라인 방 상태는 서버가 재시작되면 초기화됩니다.
- 로컬 저장/일반모드 세이브는 브라우저 쪽에 남습니다.

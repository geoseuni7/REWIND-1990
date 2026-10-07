TIME & MONEY — Render 단일파일 배포본

이 배포본은 온라인 캐릭터와 온라인 배경 이미지를 index.html 내부에 Base64로 내장했습니다.
따라서 Render에 images/ 폴더를 별도로 입력할 필요가 없습니다.

필요 파일: index.html, server.js, package.json, render.yaml, session2_assets.json

주의: server.js는 온라인 방/세션 API를 담당합니다.

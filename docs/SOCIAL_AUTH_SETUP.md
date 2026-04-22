# 소셜 로그인 설정 가이드

Mocha는 세션 기반 인증 위에 `Google`, `Kakao`, `Naver` OAuth2 로그인을 함께 붙이는 구조를 사용합니다.

## 필수 환경 변수

백엔드 실행 시 아래 환경 변수를 설정합니다.

```powershell
APP_AUTH_OAUTH2_ENABLED=true
APP_AUTH_FRONTEND_BASE_URL=http://localhost:5173

APP_AUTH_OAUTH2_GOOGLE_CLIENT_ID=...
APP_AUTH_OAUTH2_GOOGLE_CLIENT_SECRET=...

APP_AUTH_OAUTH2_KAKAO_CLIENT_ID=...
APP_AUTH_OAUTH2_KAKAO_CLIENT_SECRET=...

APP_AUTH_OAUTH2_NAVER_CLIENT_ID=...
APP_AUTH_OAUTH2_NAVER_CLIENT_SECRET=...
```

공급자별 일부만 사용할 경우 해당 공급자의 `CLIENT_ID`, `CLIENT_SECRET`만 채우면 됩니다.

## 기본 리다이렉트 경로

소셜 로그인 성공 후 이동 경로는 아래 값으로 제어할 수 있습니다.

```powershell
APP_AUTH_DEFAULT_USER_REDIRECT_PATH=/mypage
APP_AUTH_DEFAULT_ADMIN_REDIRECT_PATH=/admin
APP_AUTH_FAILURE_REDIRECT_PATH=/auth?error=social
```

## 공급자 콘솔에 등록할 콜백 URL

로컬 기준 예시는 아래와 같습니다.

```text
Google: http://localhost:8080/login/oauth2/code/google
Kakao:  http://localhost:8080/login/oauth2/code/kakao
Naver:  http://localhost:8080/login/oauth2/code/naver
```

운영 배포 시에는 `http://localhost:8080` 대신 실제 백엔드 공개 도메인을 사용합니다.

## 동작 방식

1. 프런트에서 소셜 로그인 버튼을 누르면 백엔드 OAuth2 시작 URL로 이동합니다.
2. 공급자 인증이 끝나면 백엔드가 회원을 조회하거나 신규 생성합니다.
3. 성공 시 서버 세션을 발급한 뒤 프런트 원래 화면으로 되돌립니다.
4. 동일 이메일의 기존 계정이 있으면 해당 계정에 소셜 식별자를 연결합니다.

## 운영 확인 체크리스트

- 백엔드 공개 도메인과 프런트 공개 도메인이 서로 CORS 허용 범위에 포함되어 있는지 확인합니다.
- 공급자 콘솔의 콜백 URL이 정확히 백엔드 도메인과 일치하는지 확인합니다.
- 관리자 계정으로 최초 로그인할 계획이라면 첫 생성 계정이 `ADMIN`으로 잡히는지 확인합니다.
- 회원관리 탭에서 가입 방식 컬럼과 필터가 정상 동작하는지 확인합니다.

# 개발 가이드

## 개발 환경

- Java 21
- Node.js 및 npm
- MySQL
- 선택 사항: `mediapipe-bridge` 실행용 Python 환경

## 프로필

- 런타임 및 로컬 MySQL: `application-mysql.yml`
- 테스트 전용: `application-test.yml`

테스트는 런타임 MySQL 데이터베이스를 절대 사용하지 않도록 유지해야 합니다.

## 실행 방법

### 백엔드

```powershell
cd backend
./gradlew.bat bootRun
```

MySQL 프로필을 명시적으로 쓰려면:

```powershell
cd backend
./gradlew.bat bootRun --args='--spring.profiles.active=mysql'
```

### 프런트엔드

```powershell
cd frontend
npm.cmd run dev
```

## 검증 명령

### 백엔드 빌드

```powershell
cd backend
$env:GRADLE_USER_HOME="$PWD\\.gradle-user-home"
./gradlew.bat build
```

### 프런트엔드 빌드

```powershell
cd frontend
npm.cmd run build
```

## 인증 및 관리자 메모

- 회원가입과 로그인은 서버 세션 인증을 사용합니다.
- 기존 `ADMIN` 계정이 하나도 없을 때만 새 가입자가 첫 관리자 계정이 됩니다.
- 관리자 UI는 `/api/auth/me` 응답에 의존합니다.
- 관리자 쓰기 작업은 `/api/admin/**` 경로를 사용합니다.

## 데이터베이스 메모

- 런타임 스키마는 Hibernate `ddl-auto=update`로 확장됩니다.
- 새 엔티티를 추가했다면 실제 런타임 스키마가 생성됐는지 먼저 확인해야 합니다.
- 데이터 정리가 필요할 때는 초기화보다 보존과 이관을 우선합니다.

## 문서 운영 규칙

- 현재 기준 문서는 짧고 찾기 쉽게 유지합니다.
- 오래 살아야 하는 가이드는 루트 `README.md`와 `docs/`의 기준 문서에 둡니다.
- handoff, 체크리스트, 임시 계획서는 `docs/archive/`로 이동합니다.
- 문서 진입점은 항상 `README.md` 하나로 유지합니다.

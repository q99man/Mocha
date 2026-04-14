# 아키텍처

## 전체 구조

```text
프런트엔드 (React + Vite)
    |
    v
백엔드 API (Spring Boot)
    |
    +-- MySQL
    |
    +-- MediaPipe 브리지 (선택적 처리 경로)
```

## 프런트엔드

### 앱 구조

- `src/app`: 라우터, 앱 부트스트랩, 전역 스타일
- `src/pages`: 페이지 단위 화면
- `src/features`: 챌린지와 시도 기능 조각
- `src/shared`: API 클라이언트, 인증 헬퍼, 공용 레이아웃, 공용 타입

### 라우트 구조

- 공개 라우트: `/`, `/auth`, `/challenges`, `/challenges/:id`
- 로그인 필요: `/challenges/:id/start`, `/attempts`, `/attempts/:id/result`
- 관리자 전용: `/admin/model-assets`, `/admin/challenges/:id/analysis`

### 레이아웃 분리

- `AppLayout`은 공개 사용자 화면을 담당합니다.
- `AdminLayout`은 인증된 관리자 운영 화면을 담당합니다.

## 백엔드

### 주요 패키지

- `challenge`: 챌린지 목록, 상세, 프리뷰, 모션 세션 메타데이터
- `attempt`: 시도 생성, 업로드, 진행률, 결과, 이력
- `member`: 회원가입, 로그인, 세션 인증, 현재 사용자 조회
- `admin`: 챌린지 쓰기 API와 모델 자산 운영 기능
- `scoring`: 스텁 및 비동기 완료 처리
- `motion`, `video`: 처리 지원 모듈
- `global`: 보안, 설정, 공통 구성

### API 분리 원칙

- 공개 조회 API는 `/api/challenges` 아래에 둡니다.
- 인증 및 회원 API는 `/api/auth` 아래에 둡니다.
- 회원 소유 시도 API는 `/api/attempts` 아래에 둡니다.
- 관리자 쓰기 API는 `/api/admin/**` 아래에 둡니다.

### 보안 모델

- 세션 기반 인증
- `USER`, `ADMIN` 역할 사용
- `/api/admin/**`는 `ADMIN`만 접근 가능
- 시도 관련 API는 로그인 필요

## 데이터 모델 방향

### 현재 주요 엔티티

- `Member`
- `Challenge`
- `ChallengeVideo`
- `Attempt`
- `AttemptProcessingJob`

### 중요한 규칙

- 시도 데이터는 회원에게 귀속됩니다.
- 공개 챌린지 조회는 활성화된 챌린지만 노출합니다.
- 관리자 수정 및 삭제는 명시적인 REST 엔드포인트로 처리합니다.
- 테스트는 런타임 MySQL을 사용하면 안 됩니다.

## 저장소

- 런타임: MySQL
- 테스트: `application-test.yml` 기반 H2
- Redis: 선택적 보조 인프라, 원본 데이터 저장소 금지

## 연동 메모

- MediaPipe 브리지는 `mediapipe-bridge/`에 있습니다.
- 백엔드는 스텁 모드와 HTTP 브리지 연동 모드를 모두 지원합니다.
- 브리지 실행 문서는 [../mediapipe-bridge/README.md](../mediapipe-bridge/README.md)에 정리되어 있습니다.

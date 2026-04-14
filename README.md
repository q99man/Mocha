# Mocha

Mocha는 모션 챌린지 웹 플랫폼입니다. 사용자는 활성화된 챌린지를 둘러보고, 시도 영상을 업로드하고, 점수를 확인하고, 자신의 이력을 다시 볼 수 있습니다. 관리자 사용자는 REST/CRUD 중심 운영 화면에서 챌린지와 모델 자산을 관리합니다.

## 현재 구현된 범위

- 공개 챌린지 목록, 상세, 시작 흐름
- 시도 업로드, 처리 진행률, 결과, 개인 이력 조회
- 세션 기반 회원가입, 로그인, 로그아웃, `me` API
- 관리자 전용 챌린지 생성, 수정, 활성/비활성 전환, 분석, 삭제
- MediaPipe 브리지 연동 경로
- 런타임 MySQL 프로필과 테스트용 H2 프로필 분리

## 저장소 구조

```text
backend/            Spring Boot API
frontend/           React + Vite 웹 앱
mediapipe-bridge/   MediaPipe 처리용 FastAPI 브리지
docs/               현재 기준 프로젝트 문서
```

## 먼저 읽을 문서

- 제품 개요와 범위: [docs/PRODUCT.md](docs/PRODUCT.md)
- 구조와 모듈 맵: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 로컬 실행과 개발 가이드: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- 현재 상태와 다음 마일스톤: [docs/ROADMAP.md](docs/ROADMAP.md)
- 과거 기록 보관소: [docs/archive/README.md](docs/archive/README.md)

## 로컬 실행

### 백엔드

```powershell
cd backend
./gradlew.bat bootRun
```

기본 로컬 실행은 MySQL이 연결되어 있다고 가정합니다.

### 프런트엔드

```powershell
cd frontend
npm.cmd run dev
```

### MediaPipe 브리지

```powershell
cd mediapipe-bridge
./run-bridge.ps1
```

## 현재 운영 원칙

- 런타임 데이터베이스는 MySQL을 사용합니다.
- 테스트 데이터베이스는 H2를 사용합니다.
- 관리자 및 운영 기능은 우선 REST/CRUD 기본형으로 시작합니다.
- Redis는 보조 인프라일 뿐, 원본 데이터 저장소가 아닙니다.

## 참고

- 현재 관리자 UI는 운영 화면 역할을 하며, 이후 회원/권한 기능이 더 성숙하면 인증 기반 관리자 페이지로 확장할 예정입니다.
- 브리지 서브프로젝트 문서는 [mediapipe-bridge/README.md](mediapipe-bridge/README.md)에 따로 정리되어 있습니다.

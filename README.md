# Mocha

> 사용자가 모션 챌린지 영상을 따라 하고, 업로드한 시도 영상의 처리 결과와 점수를 확인하는 **Spring Boot + React 기반 모션 챌린지 플랫폼**입니다.

Mocha는 “짧게 따라 하고 바로 피드백 받는” 경험에 집중한 웹 기반 챌린지 프로젝트입니다. 공개 사용자 UX는 챌린지 탐색과 참여에 집중하고, 관리자 UX는 챌린지와 모델 자산 운영에 집중하도록 분리했습니다. MVP 단계에서도 운영 가능한 구조를 목표로 챌린지/시도 도메인, 인증/인가, 업로드 처리 흐름, MediaPipe 분석 브리지까지 구성했습니다.

---

## Quick Links

| 구분 | 내용 |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Backend | Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA |
| Bridge | Python, FastAPI, MediaPipe, OpenCV |
| Database | MySQL 8.4, H2 Test Profile |
| Infra | Docker Compose, Redis |
| Local Frontend | `http://localhost:5173` |
| Local Backend | `http://localhost:8080` |
| MediaPipe Bridge | `http://localhost:8000` |

---

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [서비스 흐름](#서비스-흐름)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [담당 역할](#담당-역할)
- [핵심 구현](#핵심-구현)
- [트러블슈팅](#트러블슈팅)
- [실행 방법](#실행-방법)
- [화면 이미지](#화면-이미지)
- [저장소 구조](#저장소-구조)

---

## 프로젝트 소개

Mocha는 사용자가 활성화된 챌린지를 선택하고, 기준 동작을 확인한 뒤 자신의 시도 영상을 업로드해 처리 결과를 확인하는 모션 챌린지 플랫폼입니다.

이 프로젝트는 단순 영상 업로드 서비스가 아니라, **챌린지 탐색 → 시도 업로드 → 처리 진행률 확인 → 점수/결과 확인 → 개인 이력 조회**로 이어지는 사용자 경험을 중심으로 설계했습니다. 운영자는 관리자 화면에서 챌린지를 관리하고, 기준 영상 분석과 모델 자산 운영을 수행할 수 있습니다.

---

## 서비스 흐름

| 사용자 | 흐름 |
| --- | --- |
| 공개 사용자 | 챌린지 탐색 -> 상세/레퍼런스 확인 -> 로그인 |
| 로그인 사용자 | 시도 업로드 -> 진행률 확인 -> 결과 확인 -> 개인 이력 조회 |
| 관리자 | 관리자 로그인 -> 챌린지 CRUD/활성 토글 -> 모델 자산 관리 -> 레퍼런스 분석 실행 |

---

## 주요 기능

### 공개 사용자

- 활성 챌린지 목록 조회
- 챌린지 상세 조회
- 레퍼런스 프리뷰 확인

### 로그인 사용자

- 세션 기반 회원가입, 로그인, 로그아웃
- `me` API 기반 현재 사용자 조회
- 챌린지 시도 시작
- 시도 영상 업로드
- 처리 진행률 및 결과 확인
- 개인 시도 이력 조회

### 관리자

- 관리자 로그인
- 챌린지 생성, 수정, 삭제
- 챌린지 활성/비활성 토글
- 모델 자산 관리
- 챌린지 기준 영상 레퍼런스 분석 실행

---

## 기술 스택

### Frontend

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)

### Backend

![Java](https://img.shields.io/badge/Java_21-007396?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.3-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=flat-square&logo=springsecurity&logoColor=white)
![Spring Data JPA](https://img.shields.io/badge/Spring_Data_JPA-6DB33F?style=flat-square&logo=spring&logoColor=white)
![OAuth2 Client](https://img.shields.io/badge/OAuth2_Client-000000?style=flat-square)
![Actuator](https://img.shields.io/badge/Actuator-6DB33F?style=flat-square&logo=spring&logoColor=white)

### Bridge / Analysis

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=flat-square)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white)

### Database / Infra / Test

![MySQL](https://img.shields.io/badge/MySQL_8.4-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7.4-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![H2](https://img.shields.io/badge/H2_Test_Profile-1021FF?style=flat-square)
![Spring Boot Test](https://img.shields.io/badge/Spring_Boot_Test-6DB33F?style=flat-square&logo=springboot&logoColor=white)

---

## 담당 역할

개인 프로젝트로 기획부터 구현, 문서화까지 직접 진행했습니다.

- 공개 UX/관리자 UX를 분리한 라우팅·레이아웃 구조 설계 및 구현
- 챌린지/시도 도메인 모델링
- 업로드 -> 처리 -> 결과/이력 조회로 이어지는 end-to-end 흐름 구현
- 세션 기반 인증과 `USER`/`ADMIN` 역할 분리
- `/api/admin/**` 관리자 API 보호 정책 구성
- MySQL 런타임 프로필과 H2 테스트 프로필 분리
- MediaPipe 기반 분석을 FastAPI 브리지로 분리해 확장 가능한 처리 경로 마련

---

## 핵심 구현

### 1. 시도 업로드 -> 처리 진행률 -> 결과/이력 조회 플로우

**문제**  
업로드, 처리, 결과 확인이 분리되면 사용자는 자신의 시도가 어떤 상태인지 알기 어렵습니다.

**해결**  
시도를 작업 상태로 모델링하고, 업로드 이후 처리 진행률과 결과 조회를 하나의 흐름으로 연결했습니다.

**결과**  
사용자는 업로드 이후에도 처리 상태를 추적할 수 있고, 완료 후 결과와 개인 이력까지 자연스럽게 이어서 확인할 수 있습니다.

### 2. 세션 인증 + 관리자 경로 분리

**문제**  
MVP 단계에서도 운영 기능은 일반 사용자 기능과 명확히 분리되고 보호되어야 합니다.

**해결**  
세션 기반 인증을 중심으로 `USER`/`ADMIN` 역할을 두고, 관리자 쓰기 API를 `/api/admin/**` 경로로 분리했습니다.

**결과**  
공개 UX와 운영 UX의 경계가 분명해져 유지보수와 확장이 쉬운 구조를 만들었습니다.

### 3. MediaPipe 분석 브리지 분리

**문제**  
비디오/포즈 분석 기능을 Spring Boot 백엔드에 직접 결합하면 의존성, 배포, 성능 튜닝이 복잡해질 수 있습니다.

**해결**  
MediaPipe 분석을 FastAPI 브리지로 분리하고, 백엔드는 HTTP를 통해 분석 요청을 보내는 구조로 구성했습니다.

**결과**  
분석 워커, 모델 업데이트, 성능 튜닝을 백엔드와 독립적으로 진행할 수 있는 확장 경로를 마련했습니다.

---

## 트러블슈팅

### 로컬에서 MySQL 접속 실패 또는 설정이 꼬이는 문제

| 구분 | 내용 |
| --- | --- |
| 증상 | 백엔드 실행 시 DB 연결 오류가 발생하거나, 도커 MySQL 계정과 백엔드 계정이 맞지 않아 접속 실패 |
| 원인 | `docker-compose.yml`의 `MYSQL_USER=motion`, `MYSQL_PASSWORD=motion` 값과 백엔드 MySQL 프로필 또는 로컬 `.env` 값이 서로 다름 |
| 해결 | `.env.example`을 복사해 `.env`를 만들고, 도커 MySQL 설정과 동일하게 `MYSQL_*` 값을 맞춤 |
| 배운 점 | 로컬 실행에서 가장 큰 비용은 코드보다 환경 불일치이며, 도커/프로필/환경변수의 단일 기준을 유지하는 것이 중요함 |

도커를 쓰지 않는다면 본인 로컬 MySQL 계정과 비밀번호에 맞춰 `.env` 또는 `application-mysql.yml` 값을 일관되게 맞춰야 합니다.

---

## 실행 방법

### 0. 환경 준비

- Java 21
- Node.js + npm
- Docker Desktop 권장: MySQL/Redis 실행용
- Python 환경 선택: `mediapipe-bridge` 실행용

### 1. 환경변수 준비

백엔드는 실행 시 루트 또는 백엔드 경로의 `.env` 파일을 읽을 수 있습니다.

- `./.env`
- `./backend/.env`

가장 빠른 시작:

```powershell
copy .env.example .env
```

예시 값은 [.env.example](.env.example)을 참고하세요.

### 2. MySQL/Redis 실행

```powershell
docker compose up -d
```

### 3. Backend 실행

```powershell
cd backend
.\gradlew.bat bootRun --args='--spring.profiles.active=mysql'
```

백엔드는 기본적으로 `http://localhost:8080`에서 실행됩니다.

### 4. Frontend 실행

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

프론트엔드는 기본적으로 `http://localhost:5173`에서 실행됩니다.

### 5. MediaPipe Bridge 실행

브리지는 선택 기능이며 `.task` 모델 파일이 필요합니다. 기본 후보 파일을 `mediapipe-bridge/models/`에서 탐색하고, 필요 시 환경변수로 경로를 지정할 수 있습니다.

```powershell
cd mediapipe-bridge
.\run-bridge.ps1
```

모델 경로를 직접 지정하려면 다음처럼 실행합니다.

```powershell
$env:MEDIAPIPE_BRIDGE_MODEL_PATH='C:\path\to\pose_landmarker_heavy.task'
cd mediapipe-bridge
.\run-bridge.ps1
```

---

<a id="화면-이미지"></a>

## 화면 이미지

<details>
<summary><b>사용자 흐름 UX Flow</b></summary>

<img width="900" alt="UX Flow" src="docs/screenshots/portfolio_slide_01.jpg" />

</details>

<details>
<summary><b>사용자 흐름 Play Flow</b></summary>

<img width="900" alt="Play Flow" src="docs/screenshots/portfolio_slide_02.JPG" />

</details>

<details>
<summary><b>관리자 화면 보기</b></summary>

<img width="900" alt="운영 허브" src="docs/screenshots/portfolio_slide_03.jpg" />

</details>

<details>
<summary><b>챌린지 분석 보기</b></summary>

<img width="900" alt="챌린지 관리" src="docs/screenshots/portfolio_slide_04.jpg" />

</details>

---

<a id="저장소-구조"></a>

## 저장소 구조

```text
Mocha/
  backend/            Spring Boot API 서버
  frontend/           React + Vite 웹 애플리케이션
  mediapipe-bridge/   MediaPipe 처리용 FastAPI 브리지
  motion-calibration/ 모션 분석 보정 실험 영역
  docs/               README에 사용되는 스크린샷
  tmp/                로컬 임시 파일
```

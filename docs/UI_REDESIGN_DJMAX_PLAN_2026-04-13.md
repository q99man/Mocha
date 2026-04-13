# UI Redesign Plan - 2026-04-13

## Goal
- 현재의 정보형 웹 화면을 리듬게임 선택 화면 중심의 UI로 재구성한다.
- DJ MAX 계열의 감성을 참고하되, 그대로 복제하지 않고 다음 원칙만 차용한다.
  - 텍스트 최소화
  - 카드 중심 선택 경험
  - 스테이지/트랙 셀렉트 같은 몰입감
  - 강한 타이포와 조명감 있는 배경
  - 키보드/휠/드래그로 탐색 가능한 캐러셀

## Product Direction
- `랜딩 페이지`와 `플레이 진입 화면`을 분리한다.
- 사용자는 먼저 세계관과 분위기를 보고 들어오고, 실제 탐색은 별도 셀렉트 화면에서 한다.
- 챌린지 탐색은 기존 리스트형 브라우징보다 `대표 카드 1장 중심`으로 바꾼다.
- 메인 화면의 설명 텍스트는 줄이고, 시각적 상태와 인터랙션으로 의미를 전달한다.

## Target Information Density
- 항상 보이는 텍스트:
  - 브랜드명
  - 현재 선택된 챌린지 제목
  - 난이도
  - 준비 상태
  - 진입 버튼
- 숨기거나 축소할 텍스트:
  - 긴 소개 문단
  - 반복되는 안내 문장
  - 운영형 상태 설명
  - 필터/정렬 문구

## IA Draft
- `/`
  - 랜딩 페이지
- `/challenges`
  - 메인 챌린지 셀렉트 화면
- `/challenges/:id`
  - 선택된 챌린지의 트랙 정보 화면
- `/challenges/:id/start`
  - 실제 촬영/업로드 준비 화면
- `/attempts/:id/result`
  - 결과 리포트 화면

## Core Visual Language
- 배경
  - 어두운 스테이지 톤
  - 블루/시안/레드 또는 네온 앰버 계열 포인트
  - 라이트 블룸, 얇은 라인, 미세 그리드
- 타이포
  - 헤드라인은 크고 짧게
  - 본문은 최소화
  - 숫자와 상태는 HUD처럼 보이게
- 모션
  - 진입 시 카드 부상
  - 선택 카드 확대/광택
  - 옆 카드 패럴랙스
  - 배경 글로우와 슬로우 패닝

## Screen Structure

### 1. Landing Page
- 목적
  - 브랜드 인상 전달
  - 즉시 진입 유도
- 구성
  - Hero
  - 한 줄 가치 제안
  - 대표 챌린지 프리뷰
  - 진입 CTA
- 텍스트 규칙
  - 1스크린 기준 본문 2~3줄 이내

### 2. Challenge Select
- 목적
  - 사용자가 챌린지를 고르는 핵심 화면
- 구성
  - 중앙 메인 카드
  - 좌우 보조 카드
  - 최소 HUD
  - 빠른 진입 버튼
- 상호작용
  - 좌우 화살표
  - 마우스 휠
  - 터치/드래그
  - 엔터로 진입

### 3. Challenge Track View
- 목적
  - 선택한 챌린지의 상태 확인
  - 시작 전 마지막 확인
- 구성
  - 큰 썸네일/영상 비주얼
  - 제목/난이도/재도전 상태
  - 시작 CTA
  - 최근 재도전 요약

### 4. Start Console
- 목적
  - 실제 촬영/업로드 실행
- 구성
  - 장치 상태
  - 카메라/업로드 패널
  - 최근 점수 힌트
- 방향
  - 현재 기능은 유지
  - 외형만 더 게임 HUD처럼 정리

### 5. Result Report
- 목적
  - 결과를 리듬게임 리절트 화면처럼 재구성
- 구성
  - 큰 점수
  - 핵심 축 3개
  - 이전 시도 대비 변화
  - 재도전 CTA

## Wireframe Draft

### Landing
```text
 ---------------------------------------------------------
| LOGO                                                    |
|                                                         |
|                 [ MAIN HERO TITLE ]                     |
|            [ short tagline / one sentence ]             |
|                                                         |
|      [ Enter Stage ]   [ Browse Challenges ]            |
|                                                         |
|         [ featured challenge visual preview ]           |
 ---------------------------------------------------------
```

### Challenge Select
```text
 ---------------------------------------------------------
| top nav minimal                                         |
|                                                         |
|   [prev]   [ side card ] [ main card ] [ side card ]    |
|                                                         |
|                 CHALLENGE TITLE                         |
|           difficulty / ready / latest score             |
|                                                         |
|         [ Start ]   [ Info ]   [ Archive ]              |
 ---------------------------------------------------------
```

### Challenge Track View
```text
 ---------------------------------------------------------
| large visual / video                                    |
|                                                         |
| title                                                   |
| short meta row                                          |
| ready state / latest retry info                         |
|                                                         |
| [ Start Challenge ]   [ Open Recent Result ]            |
 ---------------------------------------------------------
```

## Component Draft
- `StageShell`
- `LandingHero`
- `ChallengeCarousel`
- `ChallengeCarouselCard`
- `ChallengeHUD`
- `TrackSummaryPanel`
- `StageCTAButton`
- `AmbientBackdrop`

## Technical Approach
- React + TypeScript 유지
- Tailwind CSS 기반으로 전환하거나 현재 스타일과 병행 가능
- 우선순위는 다음과 같다.
  - 공용 디자인 토큰
  - 레이아웃
  - 캐러셀 인터랙션
  - 페이지별 적용

## Tailwind Introduction Strategy
- 한 번에 전면 교체하지 않는다.
- 1차는 랜딩/챌린지 셀렉트 신규 화면만 Tailwind 중심으로 작성한다.
- 기존 페이지는 필요한 동안 유지한다.
- 이후 결과 페이지와 시작 화면을 순차적으로 갈아탄다.

## First Implementation Scope
- `AppLayout` 최소 헤더화
- `HomePage`를 랜딩 페이지로 교체
- `ChallengesPage`를 캐러셀 셀렉트 화면으로 교체
- 기존 `ChallengeDetailPage`는 과도기용 유지

## Risks
- 현재 프론트 일부 파일은 인코딩 이력이 있어 대규모 rewrite 시 다시 깨질 수 있다.
- 랜딩/메인/상세를 동시에 바꾸면 범위가 너무 커질 수 있다.
- 캐러셀 구현을 먼저 잘못 잡으면 접근성과 모바일 대응이 흔들릴 수 있다.

## Safe Work Order
1. 디자인 토큰 문서화
2. 공용 배경/버튼/패널 컴포넌트 제작
3. 랜딩 페이지 구현
4. 챌린지 캐러셀 구현
5. 상세/시작/결과 화면 순차 개편

## Tomorrow Starting Point
- 가장 먼저 할 일:
  - `frontend/src/shared/components/AppLayout.tsx`
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/pages/ChallengesPage.tsx`
- 첫 목표:
  - 텍스트 과밀 제거
  - 랜딩 Hero 완성
  - 카드형 캐러셀 첫 버전 완성

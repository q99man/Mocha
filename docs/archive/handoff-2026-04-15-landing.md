# Handoff - 2026-04-15 Landing

## 오늘 한 일
- `docs/AGENTS.md` 와 `docs/LandingPage_UI_UX_PLAN.md` 기준으로 랜딩페이지 구조를 다시 잡기 시작했다.
- 랜딩을 대시보드형 카드 덩어리에서 일반적인 웹 구조인 `header / hero / main / footer` 흐름으로 재정리했다.
- 배경 이미지는 모두 제거하고 흰/검 모노톤 중심으로 리셋했다.
- 설명 문구는 대부분 삭제했고, CTA 섹션은 구조에서 제거했다.
- 지금 상태는 "섹션 기준선만 잡힌 랜딩 골격"이다.

## 현재 랜딩 상태

### 구조
- 상단: 전체 폭 landing header
- 첫 화면: hero
- 본문: main 내부에 `feature / showcase / use-case`
- 하단: footer

### 의도
- 섹션 자체가 카드처럼 둥둥 떠 보이지 않도록 전체 폭 밴드형으로 구성
- 필요한 카드/메타만 각 섹션 내부에 들어가도록 정리
- 다음 세션에서 시각 방향을 새로 얹기 쉬운 상태로 단순화

## 주요 변경 파일
- `frontend/src/shared/components/AppLayout.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/features/landing/LandingHero.tsx`
- `frontend/src/features/landing/LandingFeatureSection.tsx`
- `frontend/src/features/landing/LandingShowcaseSection.tsx`
- `frontend/src/features/landing/LandingUseCaseSection.tsx`
- `frontend/src/features/landing/LandingFooter.tsx`
- `frontend/src/features/landing/landingPresentation.ts`
- `frontend/src/app/styles.css`

## 지금 남겨둔 디자인 원칙
- 불필요한 설명 문구는 넣지 않는다.
- 카드 하나하나를 완성형 컴포넌트처럼 만들기보다, 먼저 페이지 구조와 시선 흐름을 잡는다.
- 전체 페이지는 모노톤 중심으로 유지한다.
- hero, main, footer의 밀도 차이를 통해 구역을 나눈다.
- CTA 섹션은 당분간 비워두고 다시 설계한다.

## 다음 세션 시작 포인트
다음 작업은 "구조 위에 새 UI를 얹는 단계"로 보면 된다.

우선순위:
1. hero 시각 방향 재설계
2. feature / showcase / use-case의 모듈 밀도와 간격 재조정
3. header와 footer 톤 정리
4. PC / tablet / mobile에서 레이아웃 균형 최종 조정

## 추천 작업 순서
1. 브라우저에서 현재 랜딩 화면 먼저 확인
2. hero를 기준으로 타이포/정렬/버튼 톤 결정
3. 그 다음 main 섹션의 간격, 컬럼 수, 메타 표현 방식 통일
4. 마지막에 모바일에서 줄바꿈과 간격만 정리

## 검증 상태
- `frontend`: `npm.cmd run build` 통과

## 메모
- 현재 상태는 "완성 디자인"이 아니라 "다음 고도화를 위한 안전한 구조 정리본"이다.
- 다음 세션에서는 설명을 다시 늘리지 말고, 시각 질감과 정보 밀도를 조절하는 쪽으로 들어가면 된다.

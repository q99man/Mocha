# Mocha Handoff 2026-04-22 Motion Scoring

## 목적

기존 프레임 중심 채점 흐름을 `초 단위 score spot 기반 채점`으로 바꾸는 작업을 진행 중이다.

- 챌린지 길이: 10초 ~ 30초
- 채점 방식: 초마다 1개 cue를 두고 최대 30개 spot 채점
- 최종 점수 목표:
  - motion 90점
  - composition 10점
  - motion 내부 비중: pose 70%, timing 30%
  - 실제 환산식 예시: pose 63 + timing 27 + composition 10 = 총 100

## 지금까지 완료한 작업

### 1. MediaPipe 분석 결과를 전체 구간 기준으로 샘플링하도록 변경

파일:

- `mediapipe-bridge/app/analysis.py`

핵심 내용:

- 예전처럼 초반 일부 프레임만 보고 끝내지 않고, 비디오 전체 길이에 걸쳐 목표 프레임 인덱스를 균등 배치하도록 변경
- `scoreSpots` 개념 추가
- 분석 요약(`analysisSummary`)에 초 단위 채점용 메타데이터를 담도록 확장
- sampling 관련 부가 메타도 함께 저장

추가된 주요 헬퍼:

- `resolve_target_frame_indices`
- `resolve_score_spot_count`
- `build_score_spots`
- `score_spot_candidate_quality`
- `resolve_focus_segment_for_ratio`

### 2. 챌린지 기준 포즈 미리보기를 scoreSpots 기준으로 변경

파일:

- `backend/src/main/java/com/motionchallenge/challenge/dto/ChallengeReferencePoseFrameResponse.java`
- `backend/src/main/java/com/motionchallenge/challenge/service/ChallengeService.java`
- `frontend/src/shared/types/challenge.ts`
- `frontend/src/features/challenges/ChallengeReferencePosePreview.tsx`
- `frontend/src/app/styles.css`

핵심 내용:

- 기존 3장 중심 미리보기가 아니라, 챌린지 길이에 맞춘 초 단위 preview spot 목록을 사용할 수 있게 변경
- 프론트는 `timestampMs` 기준으로 실제 비디오 위치를 정확히 캡처하도록 수정
- `secondIndex`, `focusRegion`, `poseWeight`, `timingWeight` 메타를 UI에 연결
- preview grid를 더 컴팩트하게 정리

### 3. 공식 판정 타임라인 cue를 scoreSpots 기준으로 변경

파일:

- `backend/src/main/java/com/motionchallenge/attempt/application/AttemptJudgementTimelineService.java`

핵심 내용:

- 이제 reference profile에 `scoreSpots`가 있으면 그것을 판정 cue의 기준 앵커로 사용
- 없을 때만 기존 heuristic cue 계산으로 fallback
- `CueAnchor`가 `timestampMs`, `secondIndex`, `preferredWindowMs`를 직접 들고 다니도록 확장

## 현재 아직 안 한 작업

가장 중요한 다음 단계는 `최종 점수 계산`을 실제로 score spot 기반으로 바꾸는 것이다.

우선 수정 대상:

- `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`

해야 할 일:

- reference profile의 `scoreSpots` 파싱
- spot별 pose/timing 점수 계산
- 최종 점수를 `motion 90 + composition 10` 구조로 재조립
- scoreSpots가 없는 예전 데이터는 기존 로직으로 fallback 유지

## 다음 작업 순서

집에서 이어서 할 때는 아래 순서로 진행하면 된다.

1. `DefaultScoringService.java`에서 `scoreSpots`를 읽는 파싱 계층부터 추가
2. reference spot 기준으로 attempt 구간을 매칭하는 점수 계산 함수 추가
3. pose/timing/composition을 분리한 최종 환산식 적용
4. breakdown 응답 구조가 있으면 spot 단위 결과가 반영되도록 조정
5. 프론트 결과 화면에서 `3개 스팟`이 아니라 `초당 spot 목록`을 소비하도록 연결
6. 이후 통합 테스트 보강

## 검증 결과

이번 단계에서 확인한 결과:

- `frontend`: `npm.cmd run build` 통과
- `backend`: `./gradlew.bat compileJava` 통과
- `backend`: `./gradlew.bat test --tests com.motionchallenge.attempt.application.AttemptJudgementTimelineServiceTest` 통과
- `mediapipe-bridge`: `python -m py_compile mediapipe-bridge/app/analysis.py mediapipe-bridge/app/schemas.py` 통과

## 아직 남아 있는 테스트 이슈

전체 빌드 기준으로는 실패 테스트가 남아 있었다. 이번 단계 핵심 변경과 직접 무관할 수 있지만, 무시하고 끝내면 안 된다.

이전에 확인된 실패 테스트:

- `MotionCalibrationSampleReportTest`
- `AttemptScoringBreakdownIntegrationTest`
- `HttpMediaPipeBridgeClientTest`

의미:

- 현재까지 반영한 `scoreSpots 기반 기반작업` 자체는 컴파일과 핵심 타임라인 테스트 기준으로는 정상
- 하지만 최종 scoring 단계까지 연결한 뒤에는 위 테스트도 다시 확인해야 함

## 이번 작업에서 실제로 손댄 파일

- `mediapipe-bridge/app/analysis.py`
- `backend/src/main/java/com/motionchallenge/challenge/dto/ChallengeReferencePoseFrameResponse.java`
- `backend/src/main/java/com/motionchallenge/challenge/service/ChallengeService.java`
- `backend/src/main/java/com/motionchallenge/attempt/application/AttemptJudgementTimelineService.java`
- `frontend/src/shared/types/challenge.ts`
- `frontend/src/features/challenges/ChallengeReferencePosePreview.tsx`
- `frontend/src/app/styles.css`

## 작업 시 주의사항

- 현재 워크트리에 이번 작업 외에도 이미 많은 수정 사항이 섞여 있음
- 집에서 이어서 할 때 `git status --short` 먼저 확인하고, 내가 진행할 파일만 좁혀서 보는 편이 안전함
- `frontend/src/features/challenges/ChallengeReferencePosePreview.tsx`는 한때 인코딩이 깨져서 복구한 파일이라, 다시 수정할 때 UTF-8 유지 주의
- 기존 데이터와의 하위 호환 때문에 `scoreSpots`가 없는 경우 fallback 경로를 계속 유지하는 것이 안전함

## 빠른 시작 명령

```powershell
git status --short
cd backend
./gradlew.bat compileJava
./gradlew.bat test --tests com.motionchallenge.attempt.application.AttemptJudgementTimelineServiceTest
cd ../frontend
npm.cmd run build
```

## 한 줄 메모

다음 시작점은 `DefaultScoringService.java`에서 `scoreSpots 기반 최종 점수 계산`으로 넘어가는 것이다.

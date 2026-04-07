# Next Session

## Latest Handoff
- 2026-04-08 local Gradle test status:
  - `*ChallengeVideoFlowIntegrationTest` passed
  - `*ChallengeVideoMediaPipeStubIntegrationTest` passed
  - `*ChallengeVideoAsyncPendingFlowIntegrationTest` passed
  - `*ChallengeVideoAsyncAutoCompleteIntegrationTest` passed
- Async pending failure/retry persistence bug is fixed by:
  - [AttemptProcessingJobStateService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/attempt/application/AttemptProcessingJobStateService.java)
  - [AsyncPendingAttemptCompletionService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/scoring/application/AsyncPendingAttemptCompletionService.java)
- Current baseline is now reliable enough to move from stub-only async flow hardening into more realistic MediaPipe bridge preparation.

## Goal
Resume the Mocha runtime-observability and async-pipeline preparation work quickly from a fresh environment.

## Current Status
- Frontend `CameraPermissionPanel` is now an operations-style trace console.
- Motion session contract includes:
  - `runtimeUpdatedAt`
  - `serverRuntimeTrace`
  - trace entry `source`
- `async-pending-stub` now has a clearer split:
  - sync path emits `ANALYSIS_IN_PROGRESS`
  - async pending path can surface `ASYNC_JOB` in `serverRuntimeTrace`
- Backend has started separating the upload pipeline:
  - [AttemptService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/attempt/application/AttemptService.java)
  - [AttemptVideoProcessingService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/attempt/application/AttemptVideoProcessingService.java)

## Open First
- [EVENT_STATE_CONTRACT.md](/C:/SpringWork/Mocha/docs/EVENT_STATE_CONTRACT.md)
- [MOTION_SESSION_RUNTIME_MATRIX.md](/C:/SpringWork/Mocha/docs/MOTION_SESSION_RUNTIME_MATRIX.md)
- [MOTION_SESSION_MANUAL_CHECKLIST.md](/C:/SpringWork/Mocha/docs/MOTION_SESSION_MANUAL_CHECKLIST.md)
- [PROGRESS.md](/C:/SpringWork/Mocha/docs/PROGRESS.md)

## First Commands
From `C:\SpringWork\Mocha\frontend`
```powershell
npm.cmd run build
```

From `C:\SpringWork\Mocha\backend`
```powershell
.\gradlew.bat build
```

If Gradle fails in this environment with `native-platform.dll`, continue with code review plus runtime verification in your local IDE instead.

## Recommended Next Task
Move to the next realism step after async baseline stabilization.

Target direction:
1. Keep `AttemptService` as the request entry point.
2. Keep [AttemptVideoProcessingService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/attempt/application/AttemptVideoProcessingService.java) as the upload-processing boundary.
3. Surface a clearer terminal state when async auto retry is exhausted.
4. Then begin the real MediaPipe bridge shape:
   - request/response schema
   - adapter boundary
   - Python/FastAPI handoff contract
5. Preserve the existing frontend observability contract while changing backend execution shape.

## Latest Backend Note
- `AttemptService` no longer emits `ANALYSIS_IN_PROGRESS` before dispatch unconditionally.
- `SyncAttemptVideoProcessingDispatcher` now owns the sync-only `ANALYSIS_IN_PROGRESS` event.
- `MotionSessionRuntimeResolver` now looks at the latest `AttemptProcessingJob` and can merge an `ASYNC_JOB` trace entry into `serverRuntimeTrace`.
- `AttemptController` now exposes `/api/attempts/video-processing-progress`.
- `CameraPermissionPanel` polls both motion session state and pending processing job progress while `ASYNC_JOB_PENDING` is active.
- `ChallengeVideoAsyncPendingFlowIntegrationTest` now covers the pending progress endpoint before and after async completion.
- The same integration test also covers progress lookup without `trackingId` as a fallback path.
- The async pending integration test now also covers the `FAILED_RETRYABLE` path by forcing analysis failure.
- A tiny `AsyncPendingAttemptJobRunner` scaffold now exists and can auto-complete pending jobs when
  `APP_ATTEMPT_ASYNC_PENDING_AUTO_COMPLETE_ENABLED=true`.
- `ChallengeVideoAsyncAutoCompleteIntegrationTest` now documents the intended behavior of the auto-complete runner.

## What To Protect
- Do not rename the runtime states again.
- Keep these stable:
  - `UPLOAD_IN_PROGRESS`
  - `UPLOAD_STORED`
  - `ANALYSIS_IN_PROGRESS`
  - `SCORING_COMPLETED`
  - `FAILED_RETRYABLE`
- Keep the trace console meaningful even if the backend execution model changes.

## Quick Success Criteria
- Frontend still builds.
- Motion session API shape stays compatible.
- `serverRuntimeTrace.source` can eventually show something beyond `TRACKER`.
- Local trace and server trace UI remain usable without redesign.

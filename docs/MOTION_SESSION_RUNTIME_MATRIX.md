# Motion Session Runtime Matrix

## Purpose
This document summarizes the current motion session runtime contract in a clean, implementation-facing format.

## Readiness State
- `REFERENCE_PENDING`
  - Reference video is missing, or reference analysis is not finished yet.
  - Upload scoring flow must stay closed.
- `UPLOAD_READY`
  - Reference analysis is complete.
  - Upload scoring flow can open.

## Runtime State
- `IDLE`
  - No active upload runtime is being tracked yet.
  - Typical UI mapping: `camera-check` or `camera-ready`
- `UPLOAD_PENDING`
  - Reference is ready and the user can move into upload.
  - Typical UI mapping: `upload-waiting`
- `UPLOAD_IN_PROGRESS`
  - Upload request is active before file storage is confirmed.
  - Typical UI mapping: `uploading`
- `UPLOAD_STORED`
  - File storage completed successfully.
  - Typical UI mapping: `uploading`
- `ANALYSIS_IN_PROGRESS`
  - Motion analysis or scoring is in progress after file storage.
  - Typical UI mapping: `uploading`
- `SCORING_COMPLETED`
  - Latest uploaded attempt completed and has an uploaded attempt video.
  - Typical UI mapping: `upload-complete`
- `FAILED_RETRYABLE`
  - Upload pipeline failed in a way that should allow retry from the same screen.
  - Typical UI mapping: `upload-waiting`

## Failure Code
- `UPLOAD_STORAGE_FAILED`
  - Failure happened while storing the uploaded video file.
- `ANALYSIS_FAILED`
  - Failure happened while running attempt motion analysis.
- `SCORING_FAILED`
  - Failure happened while calculating score from analysis output.

## Processing Job Metadata
- `completionStrategy`
  - `INLINE_FLOW`
    - no async pending handoff is active
  - `MANUAL_COMPLETION`
    - async pending job exists and a manual completion action is expected
  - `AUTO_RUNNER`
    - async pending job exists and background auto-complete runner is expected to finish it
- `retryRecommended`
  - boolean flag for retryable failure guidance
- `failureSeverity`
  - `WARN`
    - retryable but not yet escalated
  - `HIGH`
    - repeated or high-impact failure requiring stronger inspection guidance
- `failureAction`
  - `CHECK_STORAGE`
  - `RETRY_ANALYSIS`
  - `RETRY_SCORING`
  - `RETRY_UPLOAD`
- `processingAttempts`
  - total number of processing executions attempted for one pending job
- `retryCount`
  - retry counter derived from attempts after the first execution

## Frontend Inspect Mode
- `inspectModeActive`
  - frontend-derived operating mode
  - should turn on when:
    - `retryCount >= 2`
    - `failureSeverity = HIGH`
  - expected UI effect:
    - top contract strip shows `OPS MODE: INSPECT`
    - processing card shows inspection-first warning
    - main guidance copy shifts from retry-first to inspect-first

## Session Response Fields
- `challengeId`
- `readinessState`
- `runtimeState`
- `runtimeUpdatedAt`
- `serverRuntimeTrace`
- `latestAttemptId`
- `latestAttemptResultSource`
- `scoreAvailable`
- `lastFailureCode`
- `lastFailureMessage`
- `lastFailureAt`
- `sessionState`
- `recordingPhase`
- `nextAction`
- `cameraPermissionRequired`
- `recordingEnabled`
- `uploadEnabled`
- `scoringEnabled`
- `message`

## Current Backend Source Of Truth
- `ChallengeService`
  - gathers challenge facts and latest attempt facts
- `MotionSessionRuntimeResolver`
  - decides runtime state, runtime timestamp, and failure metadata
- `MotionSessionRuntimeTracker`
  - keeps temporary in-memory runtime markers and recent runtime trace history during active upload processing
- `MotionSessionStateFactory`
  - assembles the final API response

## Runtime Timestamp Rules
- `runtimeUpdatedAt`
  - should represent the best available timestamp for the current runtime state
  - tracked runtime states use the tracker timestamp
  - `SCORING_COMPLETED` and `UPLOAD_PENDING` can fall back to latest attempt time
  - readiness-only states can fall back to challenge-level timestamps such as `referenceAnalyzedAt` or `updatedAt`

## Server Trace Rules
- `serverRuntimeTrace`
  - contains the recent server-side runtime transitions remembered by the in-memory tracker
  - current implementation keeps up to 6 entries per challenge
  - intended as observability metadata, not as a durable audit log
  - helps compare frontend-local trace visibility with backend-tracked transitions

## Current Limitation
- `UPLOAD_IN_PROGRESS`, `UPLOAD_STORED`, and `ANALYSIS_IN_PROGRESS` are driven by an in-memory tracker.
- This is good enough for local runtime visibility, but not yet durable across restart, scale-out, or background workers.
- `UPLOAD_STORED` and `ANALYSIS_IN_PROGRESS` currently use a short visibility window so polling can observe them more reliably during local verification.
- `serverRuntimeTrace` shares the same limitation because it is also in-memory.

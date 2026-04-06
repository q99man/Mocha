# Event / State Contract

## Purpose
This document defines how the motion session API and the start screen should stay aligned while upload, analysis, scoring, and retry flows evolve.

The goal is to keep three things stable:
- what the frontend should show
- what the backend should report
- how we can expand the pipeline later without renaming the whole state model

## Current Frontend Local State
`frontend/src/features/motion/CameraPermissionPanel.tsx`

Flow stages:
- `camera-check`
- `camera-ready`
- `countdown-ready`
- `recording-active`
- `recording-paused`
- `upload-waiting`
- `uploading`
- `upload-complete`
- `sample-save-complete`

Auxiliary state:
- `serverSyncState`
  - `idle`
  - `syncing`
  - `synced`
  - `error`

## Current Backend Session Contract
`backend/src/main/java/com/motionchallenge/challenge/dto/MotionSessionStateResponse.java`

Readiness:
- `REFERENCE_PENDING`
- `UPLOAD_READY`

Runtime:
- `IDLE`
- `UPLOAD_PENDING`
- `UPLOAD_IN_PROGRESS`
- `UPLOAD_STORED`
- `ANALYSIS_IN_PROGRESS`
- `SCORING_COMPLETED`
- `FAILED_RETRYABLE`

Failure codes:
- `UPLOAD_STORAGE_FAILED`
- `ANALYSIS_FAILED`
- `SCORING_FAILED`

Other session fields:
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

## Current Source Of Truth
- `ChallengeService`
  - collects challenge facts and latest attempt facts
- `MotionSessionRuntimeResolver`
  - decides runtime state and failure metadata
- `MotionSessionRuntimeTracker`
  - keeps temporary in-memory runtime markers during active upload processing
- `MotionSessionStateFactory`
  - assembles the final response payload

## Frontend Mapping Rules
Readiness:
- `REFERENCE_PENDING`
  - upload scoring path stays closed
  - sample-first guidance is shown
- `UPLOAD_READY`
  - upload scoring path opens

Runtime to flowStage:
- `IDLE` -> `camera-check` or `camera-ready`
- `UPLOAD_PENDING` -> `upload-waiting`
- `UPLOAD_IN_PROGRESS` -> `uploading`
- `UPLOAD_STORED` -> `uploading`
- `ANALYSIS_IN_PROGRESS` -> `uploading`
- `SCORING_COMPLETED` -> `upload-complete`
- `FAILED_RETRYABLE` -> `upload-waiting`

Runtime to UI diagnostics:
- `UPLOAD_PENDING` -> `QUEUE`
- `UPLOAD_IN_PROGRESS` -> `SEND`
- `UPLOAD_STORED` -> `STORE`
- `ANALYSIS_IN_PROGRESS` -> `ANALYZE`
- `SCORING_COMPLETED` -> `DONE`
- `FAILED_RETRYABLE` -> `RETRY`

## Failure Metadata Rules
If `runtimeState = FAILED_RETRYABLE`:
- `lastFailureCode` should explain where the pipeline failed
- `lastFailureMessage` should explain what happened
- `lastFailureAt` should tell the user when the failure happened

The start screen should show those values directly in the runtime diagnostics.

## Runtime Timestamp Rule
- `runtimeUpdatedAt` should expose the best available timestamp for the current runtime state.
- For tracked upload states, it should come from the runtime tracker.
- For non-tracked or fallback states, it can come from latest attempt time or challenge-level timestamps.

## Server Trace Rule
- `serverRuntimeTrace` should expose recent server-side runtime transitions remembered by the in-memory runtime tracker.
- The frontend can use it to compare local polling visibility with backend-tracked state changes.
- This field improves observability; it is not yet a durable job history.
- Each trace entry can also include a `source` such as `TRACKER`, and later can expand to values like `ASYNC_JOB` or `EVENT_BUS` without changing the overall UI contract.

## Current Limitation
- `UPLOAD_IN_PROGRESS`, `UPLOAD_STORED`, and `ANALYSIS_IN_PROGRESS` are currently driven by an in-memory tracker.
- This is good enough for local runtime visibility.
- It is not yet durable across restart, multi-instance deployment, or background workers.
- `serverRuntimeTrace` has the same limitation because it shares the same tracker.

## Next Contract Upgrade
The next stable upgrade is not to rename the state model again.
The next stable upgrade is to persist or publish job progress using the same names:
- `UPLOAD_IN_PROGRESS`
- `UPLOAD_STORED`
- `ANALYSIS_IN_PROGRESS`
- `SCORING_COMPLETED`
- `FAILED_RETRYABLE`

That way the frontend can keep the same HUD and history UI while the backend moves from in-memory tracking to durable async processing.

# Motion Session Manual Checklist

## Goal
Use this checklist after backend restart to verify that the motion session API and the start screen show the expected runtime transitions.

## Preconditions
- Backend is running with the latest code.
- Frontend is running with the latest build.
- At least one challenge exists.
- For upload-flow checks, use a challenge whose reference analysis is already complete.

## Check 1: Reference Pending
1. Open a challenge whose reference analysis is not complete.
2. Confirm session response shows:
   - `readinessState = REFERENCE_PENDING`
   - `runtimeState = IDLE`
   - `runtimeUpdatedAt != null`
3. Confirm start screen shows:
   - upload path closed
   - sample-first guidance
   - runtime diagnostics with runtime updated time

## Check 2: Upload Ready
1. Open a challenge whose reference analysis is complete.
2. Confirm session response shows:
   - `readinessState = UPLOAD_READY`
   - `runtimeState = UPLOAD_PENDING`
   - `runtimeUpdatedAt != null`
3. Confirm start screen shows:
   - upload path open
   - runtime badge `QUEUE`
   - server trace count if prior upload runtime exists

## Check 3: Upload In Progress
1. Start a real video upload from the start screen.
2. Trigger session refresh while the request is still running.
3. Confirm session response can show:
   - `runtimeState = UPLOAD_IN_PROGRESS`
   - `runtimeUpdatedAt != null`
   - `serverRuntimeTrace` contains `UPLOAD_IN_PROGRESS`
4. Confirm start screen shows:
   - runtime badge `SEND`
   - backend sync copy for in-progress upload
   - server/local trace comparison summary

## Check 4: Upload Stored
1. Slow the environment enough that file storage completes before analysis finishes, if possible.
2. Trigger session refresh during that short window.
3. Confirm session response can show:
   - `runtimeState = UPLOAD_STORED`
   - `serverRuntimeTrace` contains `UPLOAD_STORED`
4. Confirm start screen shows:
   - runtime badge `STORE`
   - server coverage includes `SV STORE`

## Check 5: Analysis In Progress
1. Keep the upload request running after storage is done.
2. Trigger session refresh during analysis/scoring.
3. Confirm session response can show:
   - `runtimeState = ANALYSIS_IN_PROGRESS`
   - `serverRuntimeTrace` contains `ANALYSIS_IN_PROGRESS`
4. Confirm start screen shows:
   - runtime badge `ANALYZE`
   - server coverage includes `SV ANALYZE`

## Check 6: Scoring Completed
1. Let the upload request finish successfully.
2. Trigger session refresh.
3. Confirm session response shows:
   - `runtimeState = SCORING_COMPLETED`
   - `runtimeUpdatedAt != null`
   - `latestAttemptId != null`
   - `latestAttemptResultSource = VIDEO_UPLOAD_AUTOSCORED`
   - `scoreAvailable = true`
   - `serverRuntimeTrace` latest or recent entries include the completed path
4. Confirm start screen shows:
   - runtime badge `DONE`
   - latest result card or recent-result link
   - ops banner moves away from trace-alignment urgency when local and server traces agree

## Check 7: Retryable Failure
1. Force an upload failure.
2. Trigger session refresh after failure.
3. Confirm session response shows:
   - `runtimeState = FAILED_RETRYABLE`
   - `runtimeUpdatedAt != null`
   - `lastFailureCode != null`
   - `lastFailureMessage != null`
   - `lastFailureAt != null`
   - `serverRuntimeTrace` contains `FAILED_RETRYABLE`
4. Confirm start screen shows:
   - runtime badge `RETRY`
   - failure code label
   - failure message
   - retry guidance

## Check 8: Local / Server Trace Alignment
1. Run one or more uploads and let runtime history accumulate on the start screen.
2. Compare:
   - local `TRACE PATH`
   - `ALIGNMENT %`
   - `SERVER PATH`
   - server coverage badges (`SV QUEUE`, `SV SEND`, `SV STORE`, `SV ANALYZE`, `SV DONE`)
3. Confirm:
   - `SERVER TRACE MATCH` means local trace saw all server states
   - `SERVER TRACE PARTIAL` means polling or timing likely missed at least one server-tracked state
   - `SERVER TRACE DIVERGED` means local trace and server trace are strongly out of sync
4. Confirm ops banner reacts accordingly:
   - low alignment -> `OPS MODE TRACE ALIGN`
   - stable alignment and repeated full traces -> `OPS MODE HOLD`

## Suggested Failure Tests
- `UPLOAD_STORAGE_FAILED`
  - break storage path or upload target permissions
- `ANALYSIS_FAILED`
  - force analyzer service to throw
- `SCORING_FAILED`
  - force scoring service to throw

## Notes
- `UPLOAD_IN_PROGRESS`, `UPLOAD_STORED`, and `ANALYSIS_IN_PROGRESS` are currently very short-lived in a synchronous request.
- `UPLOAD_STORED` and `ANALYSIS_IN_PROGRESS` have a short visibility window to improve observability during polling-based verification.
- `serverRuntimeTrace` is still in-memory and local-process only, but it is useful as a server-side observability aid while the pipeline remains synchronous.
- If they are still hard to observe manually, that is expected.
- The durable fix is the next step: move upload and scoring onto a persisted async job/event model.

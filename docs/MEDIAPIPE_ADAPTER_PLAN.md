# MediaPipe Adapter Plan

## Goal
Prepare the backend so the current mock motion analyzer can be replaced with a MediaPipe-backed analyzer without changing the upload, scoring, or observability flow.

## Current Provider Switch
- `app.motion.analysis.provider=mock`
  - uses `MockMotionAnalysisService`
- `app.motion.analysis.provider=mediapipe`
  - uses `MediaPipeMotionAnalysisService`
  - now delegates to:
    - `MediaPipeBridgeRequestFactory`
    - `MediaPipeBridgeClient`
    - `MediaPipeBridgeResultMapper`

## MediaPipe Stub Mode
- `app.motion.analysis.mediapipe.stub-enabled=true`
  - enables the adapter stub path
  - uses `StubMediaPipeBridgeClient`
  - returns a MediaPipe-shaped analysis payload without calling a real external service yet
- `app.motion.analysis.mediapipe.stub-enabled=false`
  - uses `HttpMediaPipeBridgeClient`
  - now performs the real HTTP bridge call shape
  - still needs a running FastAPI service to succeed

## Stable Result Schema
Both providers now write `rawProfileData` using the same top-level JSON shape:
- `schemaVersion`
- `provider`
- `analyzerName`
- `analysisPhase`
- `sourceVideo`
- `metrics`
- `landmarks`
- `notes`
- `extras`

## Recommended Next Step
1. Keep default provider as `mock`
2. Turn on `provider=mediapipe` with `stub-enabled=true`
3. Verify reference analysis and attempt upload still move through the same runtime states
4. Run a real Python/FastAPI service that matches the documented request/response contract
5. Keep the current `MotionAnalysisResult` schema stable while only changing the bridge transport

## Real Integration Target
When the real bridge is added, `MediaPipeMotionAnalysisService` should:
- build a `MediaPipeBridgeRequest`
- send the stored video path or bytes to the bridge
- receive a `MediaPipeBridgeResponse`
- map that output into the current stable schema with `MediaPipeBridgeResultMapper`
- surface bridge failures as retryable analysis failures when possible

## Handoff Reference
- Detailed FastAPI request/response contract:
  - [MEDIAPIPE_FASTAPI_HANDOFF.md](/C:/SpringWork/Mocha/docs/MEDIAPIPE_FASTAPI_HANDOFF.md)

# MediaPipe Adapter Plan

## Goal
Prepare the backend so the current mock motion analyzer can be replaced with a MediaPipe-backed analyzer without changing the upload, scoring, or observability flow.

## Current Provider Switch
- `app.motion.analysis.provider=mock`
  - uses `MockMotionAnalysisService`
- `app.motion.analysis.provider=mediapipe`
  - uses `MediaPipeMotionAnalysisService`

## MediaPipe Stub Mode
- `app.motion.analysis.mediapipe.stub-enabled=true`
  - enables the adapter stub path
  - returns a MediaPipe-shaped analysis payload without calling a real external service yet
- `app.motion.analysis.mediapipe.stub-enabled=false`
  - selecting `provider=mediapipe` currently raises a clear not-implemented error

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
4. Replace the stub branch with a real Python/FastAPI or direct bridge call

## Real Integration Target
When the real bridge is added, `MediaPipeMotionAnalysisService` should:
- send the stored video path or bytes to the bridge
- receive structured pose/landmark output
- map that output into the current stable schema
- surface bridge failures as retryable analysis failures when possible

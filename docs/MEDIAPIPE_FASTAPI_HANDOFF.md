# MediaPipe FastAPI Handoff

## Purpose
Define the first real bridge contract between the Spring backend and a future Python/FastAPI MediaPipe service.

The current backend is already split into:
- `MediaPipeMotionAnalysisService`
- `MediaPipeBridgeRequestFactory`
- `MediaPipeBridgeClient`
- `MediaPipeBridgeResultMapper`

That means the next implementation step is to replace the stub bridge client with an HTTP client, not to redesign the motion pipeline.

## Current Backend Boundary
Backend entry:
- `MotionAnalysisService`

MediaPipe provider path:
- `MediaPipeMotionAnalysisService`

Bridge abstraction:
- `MediaPipeBridgeClient`

Current temporary implementation:
- `StubMediaPipeBridgeClient`

Current real-bridge scaffold:
- `HttpMediaPipeBridgeClient`
- `MediaPipeHttpAnalyzeRequest`
- `MediaPipeHttpAnalyzeResponse`
- runnable FastAPI stub:
  - [mediapipe-bridge/app/main.py](/C:/SpringWork/Mocha/mediapipe-bridge/app/main.py)
  - real extraction path:
    - [mediapipe-bridge/app/analysis.py](/C:/SpringWork/Mocha/mediapipe-bridge/app/analysis.py)

## Proposed HTTP Contract
Base endpoint:
- `APP_MOTION_MEDIAPIPE_ENDPOINT`

Analyze path:
- `APP_MOTION_MEDIAPIPE_ANALYZE_PATH`

Recommended request:
- `POST {endpoint}{analyzePath}`
- `Content-Type: application/json`
- Spring caller:
  - `HttpMediaPipeBridgeClient`

## Proposed Request Body
```json
{
  "schemaVersion": "v1",
  "analysisPhase": "reference",
  "sourceVideo": {
    "originalFileName": "reference.mp4",
    "storagePath": "uploads/challenges/1/reference.mp4",
    "contentType": "video/mp4",
    "size": 2483201
  },
  "runtime": {
    "timeoutMillis": 5000
  }
}
```

Required request fields:
- `schemaVersion`
- `analysisPhase`
- `sourceVideo.originalFileName`
- `sourceVideo.storagePath`
- `sourceVideo.contentType`
- `sourceVideo.size`

## Proposed Response Body
```json
{
  "provider": "mediapipe",
  "analyzerName": "mediapipe-fastapi-v1",
  "signature": 4281,
  "sampleCount": 64,
  "durationMs": 18342,
  "notes": [
    "Pose landmarks extracted successfully."
  ],
  "landmarks": [],
  "extras": {
    "bridgeMode": "FASTAPI",
    "bridgeVersion": "v1",
    "poseModel": "mediapipe-pose"
  }
}
```

Required response fields:
- `provider`
- `analyzerName`
- `signature`
- `sampleCount`
- `durationMs`
- `notes`
- `landmarks`
- `extras`

## Failure Contract
Preferred failure mapping:
- bridge timeout
  - map to retryable analysis failure
- temporary bridge unavailability
  - map to retryable analysis failure
- malformed response
  - map to analysis failure, but log as integration defect

Recommended FastAPI error shape:
```json
{
  "errorCode": "MEDIAPIPE_TIMEOUT",
  "message": "MediaPipe analysis timed out after 5000ms."
}
```

## Spring Mapping Rule
Spring should continue to publish:
- `ANALYSIS_IN_PROGRESS`
- `SCORING_COMPLETED`
- `FAILED_RETRYABLE`

The bridge must not force a new runtime vocabulary unless the whole frontend contract changes.

## Next Implementation Step
1. Run the included FastAPI bridge in `stub` mode for contract-only checks
2. Run it in `mediapipe` mode for real pose extraction checks
3. Verify `provider=mediapipe` with `stub-enabled=false`
4. Preserve the current `rawProfileData` top-level schema

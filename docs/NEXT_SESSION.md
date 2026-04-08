# Next Session

## Current Snapshot
- Frontend trace/ops console work is in a usable state.
- Async upload pipeline, pending progress surface, retry metadata, and auto-retry behavior have backend coverage.
- Local Gradle tests previously confirmed:
  - `*ChallengeVideoFlowIntegrationTest`
  - `*ChallengeVideoMediaPipeStubIntegrationTest`
  - `*ChallengeVideoAsyncPendingFlowIntegrationTest`
  - `*ChallengeVideoAsyncAutoCompleteIntegrationTest`
- Spring backend and FastAPI bridge were both started successfully in real HTTP mode.
- `verify-mediapipe-stack.ps1` passed for:
  - bridge health
  - backend API health
  - challenge list
  - motion session

## What Was Confirmed Today
- Real attempt uploads now reach the FastAPI bridge over HTTP.
- Upload path resolution is no longer the blocker.
- Bridge logs now show absolute backend upload paths such as:
  - `C:\SpringWork\Mocha\backend\uploads\attempts\...`
- The legacy `mp.solutions.pose` route is no longer the chosen direction.
- [analysis.py](/C:/SpringWork/Mocha/mediapipe-bridge/app/analysis.py) was moved toward the MediaPipe Tasks API `PoseLandmarker` path.

## Current Blocker
- The only active blocker is:
  - `POSE_LANDMARKER_MODEL_MISSING`
- Required asset:
  - [pose_landmarker_lite.task](/C:/SpringWork/Mocha/mediapipe-bridge/models/pose_landmarker_lite.task)
- Optional override:
```powershell
$env:MEDIAPIPE_BRIDGE_MODEL_PATH='C:\path\to\pose_landmarker_lite.task'
```

## First Resume Steps
1. Put a Pose Landmarker `.task` model at [pose_landmarker_lite.task](/C:/SpringWork/Mocha/mediapipe-bridge/models/pose_landmarker_lite.task) or set `MEDIAPIPE_BRIDGE_MODEL_PATH`.
2. Start the bridge:
```powershell
cd C:\SpringWork\Mocha\mediapipe-bridge
$env:MEDIAPIPE_BRIDGE_MODE='mediapipe'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
3. Start backend HTTP bridge mode:
```powershell
cd C:\SpringWork\Mocha\backend
.\run-mediapipe-http.ps1
```
4. Verify the stack:
```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1
```
5. Upload a real attempt video and confirm the flow proceeds past model loading.

## If The Model Loads Successfully
- Next likely runtime outcomes will be one of:
  - successful analysis with analyzer `mediapipe-fastapi-pose-v1`
  - `POSE_NOT_DETECTED`
  - `VIDEO_OPEN_FAILED`
- At that point continue hardening the Tasks API result mapping instead of revisiting bridge wiring.

## Important Files
- [analysis.py](/C:/SpringWork/Mocha/mediapipe-bridge/app/analysis.py)
- [main.py](/C:/SpringWork/Mocha/mediapipe-bridge/app/main.py)
- [run-bridge.ps1](/C:/SpringWork/Mocha/mediapipe-bridge/run-bridge.ps1)
- [run-mediapipe-http.ps1](/C:/SpringWork/Mocha/backend/run-mediapipe-http.ps1)
- [MEDIAPIPE_BRIDGE_VERIFICATION.md](/C:/SpringWork/Mocha/docs/MEDIAPIPE_BRIDGE_VERIFICATION.md)
- [MEDIAPIPE_FASTAPI_HANDOFF.md](/C:/SpringWork/Mocha/docs/MEDIAPIPE_FASTAPI_HANDOFF.md)

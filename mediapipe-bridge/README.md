# MediaPipe Bridge

This folder contains the first runnable FastAPI bridge scaffold for Mocha.

It is intentionally contract-first:
- Spring can call it right now through `HttpMediaPipeBridgeClient`
- it returns the documented request/response shape
- it supports both `stub` mode and `real MediaPipe pose` mode

## Run
From `C:\SpringWork\Mocha\mediapipe-bridge`

```powershell
.\run-bridge.ps1
```

Manual path:
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints
- `GET /health`
- `POST /api/v1/analyze`

## Modes
Default mode:
- `MEDIAPIPE_BRIDGE_MODE=stub`
- returns contract-stable fake landmarks

Real extraction mode:
- `MEDIAPIPE_BRIDGE_MODE=mediapipe`
- uses `opencv-python-headless` + `mediapipe` Tasks API (`PoseLandmarker`)
- reads the stored video path from Spring request payload
- requires a `.task` pose landmarker model file

Example:
```powershell
$env:MEDIAPIPE_BRIDGE_MODE='mediapipe'
.\run-bridge.ps1
```

Model path:
- default: `C:\SpringWork\Mocha\mediapipe-bridge\models\pose_landmarker_lite.task`
- override with:

```powershell
$env:MEDIAPIPE_BRIDGE_MODEL_PATH='C:\path\to\pose_landmarker_lite.task'
```

## Example Request
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

## Spring Backend Settings
Use these environment variables when you want Spring to call the FastAPI bridge:

```powershell
cd ..\backend
.\run-mediapipe-http.ps1
```

## Next Step
Tune and harden the real `mediapipe` mode in `app/analysis.py` while keeping the same response fields.

## Full Verification
- See [MEDIAPIPE_BRIDGE_VERIFICATION.md](/C:/SpringWork/Mocha/docs/MEDIAPIPE_BRIDGE_VERIFICATION.md)

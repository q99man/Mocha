# MediaPipe Bridge Verification

## Goal
Verify the Spring backend uses the real HTTP bridge path instead of the in-process stub path.

## 1. Start FastAPI Bridge
From `C:\SpringWork\Mocha\mediapipe-bridge`

```powershell
 $env:MEDIAPIPE_BRIDGE_MODE='mediapipe'
.\run-bridge.ps1
```

Expected:
- FastAPI starts on `http://localhost:8000`
- `GET http://localhost:8000/health` returns `{"status":"UP"}`

Quick check:
```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:8000/health' | Select-Object -ExpandProperty Content
```

## 2. Start Spring With MediaPipe HTTP Mode
From `C:\SpringWork\Mocha\backend`

```powershell
.\run-mediapipe-http.ps1
```

This script now starts the backend with the MySQL profile only.

## 3. Verify Reference Analysis
Use the existing challenge flow or create a new challenge with a reference video.

Expected backend behavior:
- challenge reference analysis succeeds
- analyzer name comes from FastAPI response
- `rawProfileData` keeps the existing stable top-level schema

Expected response clue:
- analyzer name should be `mediapipe-fastapi-pose-v1`

## 4. Verify Attempt Upload
Upload an attempt video through the start page or API.

Expected:
- upload and scoring still use the same runtime vocabulary
- `SCORING_COMPLETED` works as before
- in `sync-inline` mode, upload response analyzer name should be `mediapipe-fastapi-pose-v1`
- in `async-pending-stub` mode, the initial upload response stays `async-pending-stub`, and the terminal attempt detail should complete through the real FastAPI bridge path after progress polling

Useful API checks:
```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/api/health' | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/actuator/health' | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/api/challenges' | Select-Object -ExpandProperty Content
```

One-command verification:
```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1
```

If the local database is empty, you can also provision a temporary challenge from a local video and run reference analysis in the same command:
```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1 -ReferenceVideoPath 'C:\path\to\reference.mp4' -ForceProvisionChallenge
```

For a full end-to-end smoke run that also uploads an attempt video and verifies the result path, add `-ForceUploadAttempt`.
If you omit `-AttemptVideoPath`, the script reuses the reference video path for the attempt upload.
```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1 -ReferenceVideoPath 'C:\path\to\reference.mp4' -ForceProvisionChallenge -ForceUploadAttempt
```

If the upload returns `pendingTrackingId`, the script now polls the direct progress endpoint until the job reaches a terminal `COMPLETED` or `FAILED` state before it validates the final attempt detail and motion session.
Use `-PendingPollIntervalSeconds` and `-PendingPollTimeoutSeconds` if you need a slower or longer wait budget.

## 5. Failure Checks
If Spring cannot reach FastAPI:
- bridge call should fail with service-unavailable / bad-gateway style response
- async failure flow should still map into analysis failure handling

Common checks:
- Is `http://localhost:8000/health` up?
- Is `APP_MOTION_MEDIAPIPE_STUB_ENABLED=false`?
- Is `APP_MOTION_MEDIAPIPE_ANALYZE_PATH=/api/v1/analyze`?

## 6. Expected Success Criteria
- Spring no longer uses `mediapipe-*-adapter-stub`
- it uses `mediapipe-fastapi-pose-v1`
- reference and attempt flows both keep the same observability/runtime UX

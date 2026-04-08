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

Optional with MySQL:
```powershell
.\run-mediapipe-http.ps1 -Profile mysql
```

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
- result analyzer name comes from FastAPI response
- attempt analyzer name should also be `mediapipe-fastapi-pose-v1`

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

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

## 2026-04-09 Encoding Handoff
- The repo keeps suffering from text corruption when files are rewritten through PowerShell defaults or mixed editor encodings.
- Current safe rule: all source/docs files must stay `UTF-8` **without BOM**.
- `.editorconfig` already declares `charset = utf-8`, but that alone was not enough.
- `backend/build.gradle` now forces Gradle Java compilation and test runtime to use `UTF-8`.
- When rewriting files from scripts or PowerShell, prefer `System.IO.File.WriteAllText(..., new UTF8Encoding(false))` over plain `Set-Content -Encoding utf8` if BOM-free output matters.
- If Java suddenly fails with `illegal character: '\ufeff'` or `unmappable character ... for encoding UTF-8`, suspect BOM or a non-UTF-8 saved file first.
- Files that were explicitly repaired today:
  - [AttemptService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/attempt/application/AttemptService.java)
  - [DefaultScoringService.java](/C:/SpringWork/Mocha/backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java)
- Before editing any older Korean text-heavy file, re-save it as UTF-8 first or replace broken strings with ASCII/known-good UTF-8 text in the same edit.
- Verification after repair:
  - `backend ./gradlew.bat build` passed
  - `frontend npm.cmd run build` passed

- 2026-04-09 note: On Windows PowerShell 5.x, Set-Content -Encoding utf8 can write a BOM. For Java/TS source files, immediately rewrite with [System.IO.File]::WriteAllText(path, content, New-Object System.Text.UTF8Encoding(False)) if a compiler reports illegal character: '\ufeff'.

## 2026-04-09 Evening Handoff
- Current baseline is healthy again.
- `backend ./gradlew.bat build` passed.
- `frontend npm.cmd run build` passed.
- Result-view text corruption was reduced by normalizing server/client strings in:
  - `backend/src/main/java/com/motionchallenge/attempt/application/AttemptService.java`
  - `backend/src/main/java/com/motionchallenge/attempt/application/AttemptVideoProcessingService.java`
  - `backend/src/main/java/com/motionchallenge/challenge/service/MotionSessionStateFactory.java`
  - `frontend/src/shared/api/client.ts`
  - `frontend/src/shared/api/attemptApi.ts`
  - `frontend/src/shared/presentation/durableProgress.ts`
  - `frontend/src/features/attempts/AttemptHistoryList.tsx`
  - `frontend/src/features/motion/CameraPermissionPanel.tsx`
  - `frontend/src/pages/AttemptsPage.tsx`

- Scoring was upgraded in `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`.
- The score now blends:
  - pose similarity
  - timing similarity
  - detection stability
- Summary text now explains the strongest area and weakest area instead of only reporting one raw gap.

- Important encoding lesson from this turn:
  - `Set-Content -Encoding utf8` on Windows PowerShell 5.x may write BOM.
  - Java source with BOM can fail with `illegal character: '\ufeff'`.
  - After any scripted overwrite of `.java`, `.ts`, or `.tsx`, re-save with UTF-8 without BOM when in doubt.

- Recommended restart sequence at home:
  1. Start bridge in `mediapipe` mode.
  2. Start backend with MySQL using `run-mediapipe-http.ps1`.
  3. Start frontend with `npm.cmd run dev`.
  4. Re-open the result page and attempts page to confirm text is readable.

- Suggested next work item:
  - add richer result explanation on the result page using the upgraded scoring model
  - for example a short strengths-vs-weaknesses panel for pose, timing, and stability

- If text still looks broken after restart:
  - first suspect old DB rows containing already-garbled strings
  - second suspect a source file rewritten with BOM
  - use `rg "餓|筌|癲|꾨|繞|嶺|\\uFFFD" backend/src frontend/src` to find source-level corruption

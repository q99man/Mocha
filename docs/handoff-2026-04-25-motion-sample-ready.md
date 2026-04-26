# Handoff 2026-04-25 - Motion Calibration Sample Set Ready

## Current State

- Latest commit checked: `dc6879f 0424v2` on `main`, matching `origin/main`.
- `0424v2` finished the UI/motion handoff work and removed the old unreliable `motion-calibration/**` videos from git.
- User confirmed a new clean sample video set has been filmed: 5 sample categories are now available for the next scoring pass.
- The scoring path to tune is still backend MediaPipe analysis plus `DefaultScoringService`.
- Local worktree note: `backend/src/main/java/com/motionchallenge/MotionChallengeApplication.java` has a whitespace-only modified diff. Do not overwrite it unless the owner confirms.

## Sample Set Mapping

Fill this before changing scoring thresholds so test labels are explicit.

| Slot | Intended Meaning | Expected Score Band | Video Path |
| --- | --- | --- | --- |
| reference | Reference / canonical challenge video | baseline | TBD |
| strong | Reference-like successful attempt | high, around 85-100 | TBD |
| similar | Similar but imperfect attempt | medium, around 60-80 | TBD |
| wrong | Clearly different or wrong motion | low, around 15-45 | TBD |
| static | No-motion / near-static attempt | near zero, around 0-15 | TBD |
| low-confidence | Partial body / poor framing, if included | low unless pose is still reliable | TBD |

If there are exactly five files total, treat `low-confidence` as optional and keep the core four attempt categories plus one reference.

## Next Work Order

1. Copy or register the filmed videos into a stable local calibration folder.
   - Suggested local path: `motion-calibration/<challenge-slug>/reference/` and `motion-calibration/<challenge-slug>/attempts/`.
   - Confirm whether videos should be committed. Prefer keeping large raw videos untracked unless the team explicitly wants git-tracked fixtures.
2. Generate MediaPipe analysis JSON for the reference and each attempt.
   - Use the FastAPI bridge output shape already consumed by the backend.
   - Store small analysis JSON fixtures under `backend/src/test/resources/fixtures/scoring/` if they are stable enough for regression tests.
3. Run a calibration report before tuning.
   - Compare current `DefaultScoringService` results for strong, similar, wrong, static, and optional low-confidence samples.
   - Record actual score, pose similarity, timing similarity, motion amount, and summary text.
4. Tune scoring in `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`.
   - Keep the score-spot path as the primary path.
   - Preserve fallback behavior for older analysis data without `scoreSpots`.
   - Add or tighten a motion-energy floor so static samples cannot score well.
   - Tune separation in this order: static near zero, wrong low, similar medium, strong high.
5. Add regression tests in `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceTest.java` or a dedicated real-analysis calibration test.

## Key Files

- `mediapipe-bridge/app/analysis.py`
  - Produces landmarks, `analysisSummary`, `focusProfile`, and `scoreSpots`.
- `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`
  - Current final scoring implementation and score-spot comparison logic.
- `backend/src/test/resources/fixtures/scoring/`
  - Existing analysis JSON fixture location.
- `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceRealAnalysisRegressionTest.java`
  - Existing real-analysis regression entry point.
- `verify-mediapipe-stack.ps1`
  - End-to-end bridge/backend verification helper when bridge and backend are running.

## Verification Commands

From `backend/`:

```powershell
.\gradlew.bat test --tests com.motionchallenge.scoring.application.DefaultScoringServiceTest
.\gradlew.bat test --tests com.motionchallenge.scoring.application.DefaultScoringServiceRealAnalysisRegressionTest
.\gradlew.bat test --tests com.motionchallenge.scoring.application.DefaultScoringServiceCleanSetCalibrationTest "-Dmocha.cleanSetCalibration=true"
```

For the full backend check:

```powershell
.\gradlew.bat compileJava testClasses
```

For MediaPipe bridge syntax:

```powershell
python -m py_compile mediapipe-bridge/app/analysis.py mediapipe-bridge/app/schemas.py
```

## Decision Needed Before Implementation

- Exact file paths and labels for the five filmed samples.
- Whether the new raw videos should be git-tracked, ignored locally, or only converted into JSON fixtures.
- Whether `low-confidence` is part of the five required categories or an optional sixth sample.

## First Calibration Pass - 2026-04-25

Clean sample set was analyzed locally with `motion-calibration/2026-04-25-clean-set/generate-analysis.py`.
Raw videos and local analysis JSON remain ignored by git.

Current tuned scores:

| Sample | Score | Pose | Timing | Quality |
| --- | ---: | ---: | ---: | ---: |
| strong | 87 | 85 | 80 | 97 |
| similar | 79 | 82 | 80 | 96 |
| wrong | 50 | 76 | 79 | 95 |
| static | 12 | 63 | 79 | 94 |
| low-confidence | 44 | 69 | 80 | 82 |

Implemented changes:

- Fixed MediaPipe bridge metadata handling for browser-recorded WebM files:
  - OpenCV can report WebM as `fps=1000` with invalid frame count.
  - The bridge now scans timestamps, reopens the capture, and samples the full span.
  - A real upload that previously analyzed as `90000ms / 11 samples` now analyzes as about `16767ms / 172 samples`.
- Broadened score-spot timing windows so real retakes are not crushed by sub-300ms tolerance.
- Relaxed score-spot timing similarity conversion for filmed samples.
- Added score-spot pose ceilings so wrong or low-confidence attempts cannot rise too high on timing/quality alone.
- Added motion-energy floor so near-static attempts are capped near zero.
- Added low-confidence detection so poor visibility/framing is scored and explained as detection quality instead of only wrong pose shape.
- Added opt-in clean-set calibration test guarded by `mocha.cleanSetCalibration=true`.

Actual browser-upload regression check after the WebM metadata fix:

| Sample | Score | Pose | Timing | Quality |
| --- | ---: | ---: | ---: | ---: |
| actual upload moving | 50 | 66 | 75 | 92 |
| actual upload low-motion | 18 | 60 | 75 | 92 |

## Second Calibration Pass - 2026-04-26

Goal: reduce overly strict scores for real attempts without letting static or low-confidence attempts pass.

Implemented changes:

- Downweighted pose-shape features when the relevant body points are low visibility.
- Reduced the impact of low-visibility lower-body hints in the user-facing weakest-area explanation.
- Softened the score-spot pose ceiling so imperfect but moving attempts can rise above the old 50-point cap into the low-to-mid 60s.
- Kept the static motion-energy cap and low-confidence detection cap in place.

Current tuned scores:

| Sample | Score | Pose | Timing | Quality |
| --- | ---: | ---: | ---: | ---: |
| strong | 87 | 85 | 80 | 97 |
| similar | 79 | 82 | 80 | 96 |
| wrong | 66 | 76 | 79 | 95 |
| static | 12 | 63 | 79 | 94 |
| low-confidence | 44 | 72 | 80 | 82 |

Actual browser-upload regression check after visibility softening:

| Sample | Score | Pose | Timing | Quality |
| --- | ---: | ---: | ---: | ---: |
| actual upload moving | 64 | 67 | 76 | 92 |
| actual upload low-motion | 18 | 61 | 75 | 92 |

Frontend playback sync follow-up:

- Challenge selection preview now uses the visible preview video as the audio source instead of running a hidden second video for music.
- Challenge play start now waits for the reference video playback promise before starting the progress timer, reducing perceived music/video start lag.

Challenge audio normalization follow-up:

- Challenge reference videos now attempt server-side audio normalization when they are registered or replaced.
- Default target is `-16 LUFS`, true peak `-1.5 dBTP`, loudness range `11`.
- FFmpeg is required for actual normalization and can be configured with `APP_VIDEO_FFMPEG_PATH`.
- If FFmpeg is unavailable or the uploaded file cannot be processed, storage falls back to the original file so existing upload tests and non-real fixtures do not fail.
- Attempt videos are not normalized; only the reference/challenge playback source is normalized.

Post-motion cleanup:

- Removed unused frontend motion-session API/type files.
- Removed unused `AdminModelAssetsPage` and `ReviewComposer` files.
- Removed the unused backend `/api/challenges/{id}/motion-session` endpoint and its memory-only runtime tracker/event stack.
- Kept durable attempt-processing progress fields and APIs because the result page still uses them.

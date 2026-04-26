# Motion Calibration Sample Set - 2026-04-25

Place the newly filmed calibration videos in this folder. Raw videos are ignored by git; keep stable analysis JSON fixtures under `backend/src/test/resources/fixtures/scoring/` after MediaPipe extraction.

## Folder Layout

```text
motion-calibration/2026-04-25-clean-set/
  reference/
    reference-01.mp4
  attempts/
    strong-01.mp4
    similar-01.mp4
    wrong-01.mp4
    static-01.mp4
    low-confidence-01.mp4
```

If there are exactly five files total, omit `low-confidence-01.mp4` and keep one reference plus four attempts.

## Labels

| File | Meaning | Expected Score Band |
| --- | --- | --- |
| `reference/reference-01.mp4` | Canonical challenge reference motion | baseline |
| `attempts/strong-01.mp4` | Reference-like successful attempt | high, around 85-100 |
| `attempts/similar-01.mp4` | Similar but imperfect attempt | medium, around 60-80 |
| `attempts/wrong-01.mp4` | Clearly different or wrong motion | low, around 15-45 |
| `attempts/static-01.mp4` | No-motion or near-static attempt | near zero, around 0-15 |
| `attempts/low-confidence-01.mp4` | Partial body or poor framing, optional | low unless pose is still reliable |

## Next Step

After placing the files, generate MediaPipe analysis JSON for each video and use those JSON files for scoring calibration tests.

```powershell
mediapipe-bridge\.venv\Scripts\python.exe motion-calibration\2026-04-25-clean-set\generate-analysis.py
cd backend
.\gradlew.bat test --tests com.motionchallenge.scoring.application.DefaultScoringServiceCleanSetCalibrationTest "-Dmocha.cleanSetCalibration=true"
```

The generated files under `analysis/` are local calibration artifacts and are ignored by git.

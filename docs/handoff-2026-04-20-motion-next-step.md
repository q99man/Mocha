# Motion Scoring Next Step Prep

Date: 2026-04-20

## Confirmed Current State

- Working tree is clean.
- Latest local commit is `aa3aaf6` (`0420v2`).
- The previous step already improved low-quality frame tolerance in backend scoring.
- The most relevant confirmed files for the next step are:
  - `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`
  - `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceTest.java`
  - `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceRealAnalysisRegressionTest.java`
  - `backend/src/main/java/com/motionchallenge/attempt/application/AttemptJudgementTimelineService.java`
  - `mediapipe-bridge/app/analysis.py`

## Next Goal

Improve scoring and feedback accuracy by separating:

- challenge-specific key segments
- challenge-specific joint weights

This should answer:

- which segment lost points
- which joints caused the loss
- whether the loss came from pose shape, timing, or detection quality

## Why This Should Be Profile-Driven

The current code already has enough signal to support a better version of this feature, but the logic is still mostly generic and hard-coded.

Current limitations:

- `DefaultScoringService` uses fixed heuristics for arm/leg emphasis in pose hints.
- `AttemptJudgementTimelineService` uses fixed body regions and fixed joint comparisons.
- `Challenge` does not yet have dedicated scoring-config columns.
- `ChallengeMotionProfile.profileData` is already a flexible JSON payload, so we can attach challenge-specific scoring metadata there without a schema change.

Because of that, the safest path is:

1. store challenge-specific scoring hints inside the reference profile JSON
2. parse the same hints in backend scoring/timeline services
3. keep a strong default fallback when the profile does not contain those hints

## Recommended Data Contract

Add an optional block under `extras.analysisSummary` in the reference profile JSON.

Suggested shape:

```json
{
  "focusProfile": {
    "version": "v1",
    "primaryJoints": [
      { "name": "leftElbow", "weight": 1.0 },
      { "name": "rightElbow", "weight": 1.0 },
      { "name": "leftKnee", "weight": 0.55 },
      { "name": "rightKnee", "weight": 0.55 }
    ],
    "segments": [
      {
        "key": "opening",
        "startRatio": 0.0,
        "endRatio": 0.25,
        "poseWeight": 0.45,
        "timingWeight": 0.20,
        "jointWeights": {
          "leftElbow": 1.0,
          "rightElbow": 1.0,
          "leftWrist": 0.85,
          "rightWrist": 0.85
        },
        "label": "opening arm setup"
      },
      {
        "key": "impact",
        "startRatio": 0.25,
        "endRatio": 0.55,
        "poseWeight": 0.70,
        "timingWeight": 1.00,
        "jointWeights": {
          "leftKnee": 0.95,
          "rightKnee": 0.95,
          "leftAnkle": 0.80,
          "rightAnkle": 0.80
        },
        "label": "main hit"
      }
    ]
  }
}
```

Notes:

- The exact numeric values can be heuristic in the first version.
- The backend should treat this block as optional.
- Old reference profiles must continue to work with no migration.

## Best Implementation Order

### 1. Produce focus metadata in the bridge

File:

- `mediapipe-bridge/app/analysis.py`

Add a helper that derives a first-pass `focusProfile` from the sampled landmarks.

Recommended first version:

- compute per-joint motion/angle-change importance over time
- split the reference motion into 3 to 5 coarse segments by timeline ratio
- mark segments with higher motion energy or larger joint-angle changes as more important
- keep the output deterministic and bounded

Important:

- do not overfit the first version
- keep it heuristic and explainable
- continue returning existing `analysisSummary` fields unchanged

### 2. Parse focus metadata in scoring

File:

- `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`

Add parsing for the optional `focusProfile` block when reading the reference profile.

Recommended internal objects:

- `FocusProfile`
- `FocusSegment`
- `WeightedJoint`

Keep them local to the scoring package at first unless they need to be shared elsewhere.

### 3. Use segment weights in pose/timing comparison

Primary targets inside `DefaultScoringService`:

- `calculatePoseShapeDifference(...)`
- `calculateTimingDifference(...)`
- `comparePoseShape(...)`
- summary/hint builders such as `buildPoseHint(...)` and `buildTimingHint(...)`

Recommended behavior:

- apply segment weights when selecting/alignment-scoring frame windows
- apply joint weights when computing pose descriptor gaps or joint summary gaps
- keep quality weighting from the previous step intact

Important guardrail:

- segment/joint weighting should refine scores, not completely replace whole-body comparison

### 4. Reuse the same profile in judgement timeline feedback

File:

- `backend/src/main/java/com/motionchallenge/attempt/application/AttemptJudgementTimelineService.java`

After scoring works, feed the same focus profile into timeline judgement so the lane/verdict/explanation can point to the right body area more consistently.

The shared idea should be:

- scoring says where the main loss happened
- timeline replay highlights the same area

### 5. Improve result explanation wording

Files likely affected:

- `backend/src/main/java/com/motionchallenge/scoring/application/DefaultScoringService.java`
- `backend/src/main/java/com/motionchallenge/attempt/application/AttemptService.java`

The next version of feedback should move from:

- generic "pose/timing/quality" focus hints

to:

- "main hit segment was late"
- "arm extension differed in the opening segment"
- "knee depth broke during the impact segment"

## Test Plan

### Unit tests to add first

File:

- `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceTest.java`

Add cases for:

- weighted arm challenge where elbow/wrist mismatch matters more than knee mismatch
- weighted leg challenge where knee/ankle mismatch matters more than elbow mismatch
- timing loss concentrated in one key segment
- fallback behavior when `focusProfile` is missing

### Regression tests to preserve

Files:

- `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceTest.java`
- `backend/src/test/java/com/motionchallenge/scoring/application/DefaultScoringServiceRealAnalysisRegressionTest.java`

Keep existing guarantees:

- low-quality outlier frames should not crash pose/timing scores
- different real videos should not collapse to perfect scores

### Timeline tests to add after scoring tests pass

File:

- `backend/src/test/java/com/motionchallenge/attempt/application/AttemptJudgementTimelineServiceTest.java`

Add cases where:

- the highlighted lane follows the dominant joint group from the reference focus profile
- early/late verdicts line up with the most important segment

## Things To Avoid In The First Pass

- database schema changes
- admin UI for manual weight editing
- per-challenge handcrafted configs stored outside the reference profile
- complex ML-derived weighting logic that is hard to debug

## Suggested First Coding Slice

If the next session should start with a small but high-value slice, this is the best order:

1. Add `focusProfile` generation in `mediapipe-bridge/app/analysis.py`.
2. Parse it in `DefaultScoringService` with a no-op fallback.
3. Use it only in `buildPoseHint(...)` and `buildTimingHint(...)` first.
4. After feedback labels look right, expand it into actual score weighting.

That order reduces regression risk while still making the next step visible quickly.

# Handoff 2026-04-24 - UI/UX Finish and Motion Scoring Prep

## Current State

- The main UI/UX navigation review items have been addressed:
  - Admin login default redirect now uses the returned session role.
  - Auth mode switching keeps query strings valid.
  - Challenge list/review panel state is synced back to URL params.
  - Admin hub tab clicks now preserve browser history naturally.
  - Challenge exit prompt copy now matches the fact that the play session is already stopped.
- The unused manual async-pending completion API surface was removed:
  - Frontend wrapper/type removed.
  - Backend controller/request DTO removed.
  - Security matcher removed.
  - Internal runner completion path remains.
- Responsive UI fixes are in place:
  - Mobile toast width no longer overflows narrow screens.
  - Shared glass toolbar no longer forces a 320px minimum wider than its mobile container.
  - Admin mobile action buttons keep visible labels unless explicitly icon-only.
  - Admin compact section drops the fixed minimum height on mobile.
- Challenge play screen changes:
  - Hardcoded live judgement UI was removed from the play screen.
  - Beat lane / Perfect / Good / Miss style preview feedback was removed.
  - Final scoring remains focused on the result page.
  - Mobile reference video is inset slightly from the screen edge to avoid side overflow.
  - Camera preview remains small and fixed in the top-right on mobile.
  - A non-scoring bottom play rail was added for both mobile and desktop:
    - REC/TEST mode label.
    - Remaining time.
    - Progress fill.
    - Soft beat dots.
    - Small reactions at 32%, 62%, and 90%.
    - Reactions pop above the matching progress point and are intentionally not score/verdict labels.
- Latest frontend verification:
  - `npm.cmd run build` passed after the play rail changes.
- Earlier backend verification after async completion cleanup:
  - `./gradlew.bat compileJava testClasses` passed.

## Important Notes

- The old play-time judgement feedback was only a preview pattern, not real camera analysis. It should stay removed unless a future real-time analysis feature is intentionally designed.
- The current final score path still uses backend MediaPipe analysis and `DefaultScoringService`, but calibration showed poor separation between good/borderline/miss samples.
- The existing calibration sample videos were not reliable enough for scoring tuning. The next scoring pass should wait for a clean sample set.
- Current worktree shows deleted files under `motion-calibration/**`. Before committing, confirm whether those video deletions are intentional as part of replacing the sample set.

## Next Priority

1. Create a clean calibration sample set before scoring changes:
   - One strong/reference-like attempt.
   - One similar but imperfect attempt.
   - One clearly wrong/different-motion attempt.
   - One static/no-motion attempt.
   - One low-confidence or partial-body sample if useful.
2. Define expected score bands before implementation:
   - Strong sample: high score.
   - Similar sample: medium score.
   - Wrong sample: low score.
   - Static sample: near zero.
3. Redesign final scoring around sampled frame comparison:
   - Compare reference and attempt at defined time/key-frame points.
   - Normalize by body center/scale.
   - Score pose shape, timing alignment, motion amount, framing, and body angle/position.
   - Add a motion-energy floor so static video cannot accidentally score well.
4. Run calibration report/tests against the new sample set and tune thresholds from the report.
5. After motion scoring and final responsive details are stable, revisit cleanup candidates:
   - `motionApi` / motion-session read stack, if still unused.
   - `AdminModelAssetsPage`, if router redirect remains inline.
   - `ReviewComposer`, if ChallengeReviewsPane remains the only composer.
   - Old durable progress / attempt presentation helpers.
   - Legacy admin CSS and tracked diff artifacts.
   - AttemptResultPage unused locals if still present.

## Suggested Smoke Test Before Release

- Login/register, including admin login redirect.
- Challenge list -> detail -> reviews -> back/list URL behavior.
- Challenge play on mobile width around 420px.
- Challenge play on desktop.
- Result page mobile layout.
- My page posts/reviews/attempts.
- Board create/edit/delete flows.
- Admin hub tabs, board management counts, member/challenge actions.


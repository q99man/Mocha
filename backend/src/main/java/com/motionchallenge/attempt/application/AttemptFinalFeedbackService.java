package com.motionchallenge.attempt.application;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AttemptFinalFeedbackService {

    public AttemptFinalFeedbackResponse build(
            boolean scoreAvailable,
            int score,
            String strongestArea,
            String weakestArea,
            List<AttemptJudgementCueResponse> judgementTimeline) {
        if (!scoreAvailable) {
            return null;
        }

        List<AttemptJudgementCueResponse> cues = judgementTimeline == null ? List.of() : judgementTimeline;
        int cueCount = cues.size();
        long stableCount = cues.stream()
                .filter(cue -> "PERFECT".equals(cue.verdict()) || "GOOD".equals(cue.verdict()) || "HOLD".equals(cue.verdict()))
                .count();
        long perfectCount = cues.stream().filter(cue -> "PERFECT".equals(cue.verdict())).count();
        long missCount = cues.stream().filter(cue -> "MISS".equals(cue.verdict())).count();
        long earlyCount = cues.stream().filter(cue -> "EARLY".equals(cue.verdict())).count();
        long lateCount = cues.stream().filter(cue -> "LATE".equals(cue.verdict())).count();
        int maxCombo = cues.stream().mapToInt(AttemptJudgementCueResponse::combo).max().orElse(0);

        double stableRatio = cueCount == 0 ? 0.0 : stableCount / (double) cueCount;
        double missRatio = cueCount == 0 ? 0.0 : missCount / (double) cueCount;

        Grade grade = resolveGrade(score, cueCount, stableRatio, missRatio, perfectCount, maxCombo);
        String rhythmLabel = resolveRhythmLabel(cueCount, stableRatio, missRatio, earlyCount, lateCount, maxCombo);
        String focusLabel = resolveFocusLabel(weakestArea, rhythmLabel);

        return new AttemptFinalFeedbackResponse(
                grade.name(),
                grade.badge(),
                grade.headline(),
                grade.summary() + " " + focusLabel,
                rhythmLabel,
                focusLabel,
                grade.cleared());
    }

    private Grade resolveGrade(
            int score,
            int cueCount,
            double stableRatio,
            double missRatio,
            long perfectCount,
            int maxCombo) {
        int rank = baseRank(score);
        if (cueCount > 0) {
            if (missRatio >= 0.85) {
                rank -= 1;
            } else if (missRatio >= 0.68 && maxCombo <= 2) {
                rank -= 1;
            } else if (missRatio >= 0.58 && maxCombo <= 1) {
                rank -= 1;
            }

            if (stableRatio >= 0.42 && maxCombo >= 4) {
                rank += 1;
            }
            if (perfectCount >= Math.max(2, cueCount / 5)) {
                rank += 1;
            }
        }
        return Grade.fromRank(rank);
    }

    private int baseRank(int score) {
        if (score >= 94) {
            return 4;
        }
        if (score >= 84) {
            return 3;
        }
        if (score >= 74) {
            return 2;
        }
        if (score >= 64) {
            return 1;
        }
        return 0;
    }

    private String resolveRhythmLabel(
            int cueCount,
            double stableRatio,
            double missRatio,
            long earlyCount,
            long lateCount,
            int maxCombo) {
        if (cueCount == 0) {
            return "점수 우선 결과";
        }
        if (stableRatio >= 0.50 || maxCombo >= Math.max(4, cueCount / 2)) {
            return "안정적인 흐름";
        }
        if (missRatio >= 0.72) {
            return "타이밍을 더 다듬어야 합니다";
        }
        if (earlyCount >= Math.max(2, lateCount + 2)) {
            return "주로 빠름";
        }
        if (lateCount >= Math.max(2, earlyCount + 2)) {
            return "주로 늦음";
        }
        return "일관성을 쌓는 중";
    }

    private String resolveFocusLabel(String weakestArea, String rhythmLabel) {
        if ("pose timing".equals(weakestArea)) {
            return "다음 시도에서는 박자 맞춤을 더 정확히 해보세요.";
        }
        if ("pose shape".equals(weakestArea)) {
            return "다음 시도에서는 포즈 선을 더 또렷하게 맞춰보세요.";
        }
        if ("detection quality".equals(weakestArea)) {
            return "다음 시도에서는 전신이 더 잘 보이게 해주세요.";
        }
        if ("주로 빠름".equals(rhythmLabel) || "주로 늦음".equals(rhythmLabel)) {
            return "템포를 조금 풀고 음악을 더 따라가 보세요.";
        }
        return "다음 시도는 단순하고 깔끔하게 유지해 보세요.";
    }

    private enum Grade {
        TRY_AGAIN("RETRY", "다시 도전", "모션이 아직 조금 느슨합니다.", false, 0),
        PASS("PASS", "계속 도전", "기본은 보입니다. 한 번만 더 다듬으면 결과가 빠르게 올라갑니다.", false, 1),
        GOOD("GOOD", "좋은 시도", "핵심 모션이 잘 읽히고 있어 경쟁력 있는 결과입니다.", true, 2),
        GREAT("GREAT", "훌륭한 시도", "상위권에 가까운 완성도입니다.", true, 3),
        PERFECT("PERFECT", "완벽한 시도", "흐름이 잘 맞고 흔들림이 거의 없습니다.", true, 4);

        private final String badge;
        private final String headline;
        private final String summary;
        private final boolean cleared;
        private final int rank;

        Grade(String badge, String headline, String summary, boolean cleared, int rank) {
            this.badge = badge;
            this.headline = headline;
            this.summary = summary;
            this.cleared = cleared;
            this.rank = rank;
        }

        String badge() {
            return badge;
        }

        String headline() {
            return headline;
        }

        String summary() {
            return summary;
        }

        boolean cleared() {
            return cleared;
        }

        static Grade fromRank(int rank) {
            int clampedRank = Math.max(0, Math.min(rank, 4));
            for (Grade grade : values()) {
                if (grade.rank == clampedRank) {
                    return grade;
                }
            }
            return TRY_AGAIN;
        }
    }
}

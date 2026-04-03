package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptStatus;
import org.springframework.stereotype.Component;

@Component
public class SimpleScoringPreviewService {

    public SimpleScoringResult buildResult(String attemptStatus, int score) {
        if (!AttemptStatus.COMPLETED.equals(attemptStatus)) {
            return new SimpleScoringResult(
                    false,
                    "준비 단계 기록이 저장되었습니다.",
                    "카메라 준비 단계까지 저장한 기록입니다. 이후 실제 점수 계산이 연결되면 같은 위치에 결과 요약이 표시됩니다.");
        }

        if (score >= 80) {
            return new SimpleScoringResult(
                    true,
                    "완성도가 높은 샘플 결과입니다.",
                    "현재는 단순 점수 기반 미리보기지만, 동작 흐름이 안정적으로 이어지는 상태로 볼 수 있습니다.");
        }

        if (score >= 60) {
            return new SimpleScoringResult(
                    true,
                    "기본 흐름이 맞는 샘플 결과입니다.",
                    "이후 실제 유사도 계산이 붙으면 자세 차이와 개선 포인트를 더 구체적으로 안내할 수 있습니다.");
        }

        return new SimpleScoringResult(
                true,
                "연습이 더 필요한 샘플 결과입니다.",
                "현재는 샘플 점수만 반영하고 있으며, 다음 단계에서는 어떤 동작을 보완하면 좋을지까지 안내할 예정입니다.");
    }
}
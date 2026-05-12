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
                    "이 기록은 아직 준비 단계입니다. 실제 영상을 업로드하면 자동 채점 결과를 확인할 수 있습니다.");
        }

        if (score >= 80) {
            return new SimpleScoringResult(
                    true,
                    "레퍼런스와 높은 유사도가 확인되었습니다.",
                    "현재 미리보기 점수 기준으로 업로드 영상이 레퍼런스 흐름과 상당히 가깝게 인식되었습니다.");
        }

        if (score >= 60) {
            return new SimpleScoringResult(
                    true,
                    "부분적으로 유사한 흐름을 확인했습니다.",
                    "전체적인 흐름은 비슷하지만 움직임의 세부 구간에서 차이가 감지되었습니다.");
        }

        return new SimpleScoringResult(
                true,
                "차이가 큰 구간을 다시 확인해 주세요.",
                "현재 미리보기 점수 기준으로 업로드 영상과 레퍼런스 사이에 눈에 띄는 차이가 있습니다.");
    }
}

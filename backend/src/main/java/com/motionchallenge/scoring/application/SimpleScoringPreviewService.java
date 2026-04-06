package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptStatus;
import org.springframework.stereotype.Component;

@Component
public class SimpleScoringPreviewService {

    public SimpleScoringResult buildResult(String attemptStatus, int score) {
        if (!AttemptStatus.COMPLETED.equals(attemptStatus)) {
            return new SimpleScoringResult(
                    false,
                    "준비 상태 점검 기록이 저장되었습니다.",
                    "이 결과는 실제 채점이 아니라 카메라 준비 흐름을 저장한 기록입니다. 이후 실제 업로드 자동 채점 결과도 같은 화면 구조에서 확인할 수 있습니다.");
        }

        if (score >= 80) {
            return new SimpleScoringResult(
                    true,
                    "샘플 점수 미리보기 결과가 안정적으로 생성되었습니다.",
                    "이 결과는 데모용 샘플 scoring preview입니다. 실제 업로드 자동 채점이 연결되면 같은 위치에 분석 기반 요약이 표시됩니다.");
        }

        if (score >= 60) {
            return new SimpleScoringResult(
                    true,
                    "샘플 점수 미리보기가 정상적으로 생성되었습니다.",
                    "현재는 데모용 샘플 결과이며, 이후 실제 유사도 계산이 붙으면 자세 차이와 개선 포인트를 더 구체적으로 안내할 수 있습니다.");
        }

        return new SimpleScoringResult(
                true,
                "샘플 점수 기준으로 보완 여지가 보이는 결과입니다.",
                "현재는 샘플 점수만 반영한 데모 결과입니다. 다음 단계에서는 실제 분석 기반으로 어떤 동작을 보완하면 좋을지까지 안내할 예정입니다.");
    }
}

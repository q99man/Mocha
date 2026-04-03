package com.motionchallenge.challenge.service;

import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.entity.Challenge;
import org.springframework.stereotype.Component;

@Component
public class MotionSessionStateFactory {

    private static final String SESSION_STATE_READY = "READY";
    private static final String NEXT_ACTION_REQUEST_CAMERA_PERMISSION = "REQUEST_CAMERA_PERMISSION";
    private static final String DEFAULT_MESSAGE =
            "카메라 권한을 확인하면 세션 준비가 완료됩니다. 현재 단계에서는 녹화와 점수 계산이 아직 비활성 상태입니다.";

    public MotionSessionStateResponse createReadyState(Challenge challenge) {
        return new MotionSessionStateResponse(
                challenge.getId(),
                SESSION_STATE_READY,
                NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                true,
                false,
                false,
                DEFAULT_MESSAGE);
    }
}
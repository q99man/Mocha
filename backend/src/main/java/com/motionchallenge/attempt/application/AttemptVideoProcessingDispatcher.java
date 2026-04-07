package com.motionchallenge.attempt.application;

public interface AttemptVideoProcessingDispatcher {

    AttemptResultResponse dispatch(AttemptVideoProcessingCommand command);
}
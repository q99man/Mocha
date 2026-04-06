export type MotionSessionState = {
  challengeId: number;
  readinessState: 'REFERENCE_PENDING' | 'UPLOAD_READY';
  runtimeState:
    | 'IDLE'
    | 'UPLOAD_PENDING'
    | 'UPLOAD_IN_PROGRESS'
    | 'UPLOAD_STORED'
    | 'ANALYSIS_IN_PROGRESS'
    | 'SCORING_COMPLETED'
    | 'FAILED_RETRYABLE';
  runtimeUpdatedAt: string | null;
  serverRuntimeTrace: Array<{
    runtimeState:
      | 'IDLE'
      | 'UPLOAD_PENDING'
      | 'UPLOAD_IN_PROGRESS'
      | 'UPLOAD_STORED'
      | 'ANALYSIS_IN_PROGRESS'
      | 'SCORING_COMPLETED'
      | 'FAILED_RETRYABLE';
    source: 'TRACKER' | 'ASYNC_JOB' | 'EVENT_BUS' | string;
    recordedAt: string | null;
  }>;
  latestAttemptId: number | null;
  latestAttemptResultSource:
    | 'PREPARED_FLOW'
    | 'SAMPLE_SCORING_PREVIEW'
    | 'VIDEO_UPLOAD_AUTOSCORED'
    | null;
  scoreAvailable: boolean;
  lastFailureCode:
    | 'UPLOAD_STORAGE_FAILED'
    | 'ANALYSIS_FAILED'
    | 'SCORING_FAILED'
    | null;
  lastFailureMessage: string | null;
  lastFailureAt: string | null;
  sessionState: 'REFERENCE_PENDING' | 'CAMERA_PERMISSION_REQUIRED';
  recordingPhase: 'SAMPLE_FLOW_ONLY' | 'UPLOAD_SCORING_READY';
  nextAction: 'REVIEW_REFERENCE_STATUS' | 'REQUEST_CAMERA_PERMISSION';
  cameraPermissionRequired: boolean;
  recordingEnabled: boolean;
  uploadEnabled: boolean;
  scoringEnabled: boolean;
  message: string;
};

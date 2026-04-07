export type AttemptStatus = '준비됨' | '완료됨';
export type AttemptRecordType = 'prepared' | 'completed';
export type AttemptProcessingMode = 'SYNC_INLINE' | 'ASYNC_JOB_PENDING';
export type AttemptResultSource =
  | 'PREPARED_FLOW'
  | 'SAMPLE_SCORING_PREVIEW'
  | 'VIDEO_UPLOAD_AUTOSCORED';

export type AttemptSummary = {
  id: number;
  challengeId: number;
  challengeTitle: string;
  score: number;
  status: AttemptStatus;
  resultSource: AttemptResultSource;
  scoreAvailable: boolean;
  resultHeadline: string;
  resultSummary: string;
  processingMode: AttemptProcessingMode | null;
  processingComplete: boolean;
  processingNotice: string | null;
  attemptedAt: string;
};

export type AttemptCreateRequest = {
  challengeId: number;
  score: number;
  notes?: string;
  recordType?: AttemptRecordType;
};

export type AttemptVideoUploadRequest = {
  challengeId: number;
  notes?: string;
  attemptVideo: File;
};

export type AttemptVideoResult = {
  attemptId: number | null;
  challengeId: number;
  challengeTitle: string;
  score: number;
  status: AttemptStatus;
  resultSource: AttemptResultSource;
  scoreAvailable: boolean;
  resultHeadline: string;
  resultSummary: string;
  analyzerName: string;
  processingMode: AttemptProcessingMode | null;
  processingComplete: boolean;
  processingNotice: string | null;
  pendingTrackingId: string | null;
  videoOriginalFileName: string;
  videoContentType: string;
  videoSize: number;
  attemptedAt: string;
};

export type AttemptVideoProcessingJobProgress = {
  trackingId: string;
  challengeId: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processingMode: AttemptProcessingMode;
  completionStrategy: 'INLINE_FLOW' | 'AUTO_RUNNER' | 'MANUAL_COMPLETION';
  runtimeState: string | null;
  processingNotice: string | null;
  failureCode: string | null;
  failureSeverity: 'WARN' | 'HIGH' | null;
  failureAction: 'CHECK_STORAGE' | 'RETRY_ANALYSIS' | 'RETRY_SCORING' | 'RETRY_UPLOAD' | null;
  retryRecommended: boolean;
  processingAttempts: number;
  retryCount: number;
  autoRetryEnabled: boolean;
  remainingAutoRetryCount: number;
  autoRetryExhausted: boolean;
  resultAttemptId: number | null;
  originalFileName: string | null;
  createdAt: string;
  updatedAt: string;
  elapsedSeconds: number;
};

export type AsyncPendingCompletionRequest = {
  challengeId: number;
  trackingId?: string;
  notes?: string;
};

export type AttemptStatus = 'Prepared' | 'Completed';
export type AttemptRecordType = 'prepared' | 'completed';
export type AttemptProcessingMode = 'SYNC_INLINE' | 'ASYNC_JOB_PENDING';
export type AttemptResultSource =
  | 'PREPARED_FLOW'
  | 'SAMPLE_SCORING_PREVIEW'
  | 'VIDEO_UPLOAD_AUTOSCORED';

export type AttemptBreakdownArea = 'pose shape' | 'pose timing' | 'detection quality';
export type AttemptJudgementVerdict = 'PERFECT' | 'GOOD' | 'HOLD' | 'EARLY' | 'LATE' | 'MISS';
export type AttemptJudgementSource = 'motion-analysis' | 'timeline-preview';
export type AttemptFinalGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'PASS' | 'TRY_AGAIN';

export type AttemptJudgementCue = {
  id: number;
  beatIndex: number;
  second: number;
  triggerMs: number;
  windowMs: number;
  lane: number;
  accent: boolean;
  combo: number;
  verdict: AttemptJudgementVerdict;
  source: AttemptJudgementSource;
  offsetMs: number;
  confidence: number;
};

export type AttemptFinalFeedback = {
  grade: AttemptFinalGrade;
  badge: string;
  headline: string;
  summary: string;
  rhythmLabel: string;
  focusLabel: string;
  cleared: boolean;
};

export type AttemptSummary = {
  id: number;
  challengeId: number;
  challengeTitle: string;
  attemptVideoUrl: string | null;
  memberId: number;
  memberDisplayName: string;
  memberEmail: string;
  score: number;
  status: AttemptStatus;
  resultSource: AttemptResultSource;
  scoreAvailable: boolean;
  resultHeadline: string;
  resultSummary: string;
  finalFeedback: AttemptFinalFeedback | null;
  judgementTimeline: AttemptJudgementCue[];
  processingMode: AttemptProcessingMode | null;
  processingComplete: boolean;
  processingNotice: string | null;
  pendingTrackingId: string | null;
  durableProgressStatus: AttemptVideoProcessingJobProgress['status'] | null;
  completionStrategy: AttemptVideoProcessingJobProgress['completionStrategy'] | null;
  elapsedSeconds: number | null;
  autoRetryEnabled: boolean;
  remainingAutoRetryCount: number;
  autoRetryExhausted: boolean;
  originalFileName: string | null;
  poseSimilarity: number | null;
  timingSimilarity: number | null;
  stabilitySimilarity: number | null;
  strongestArea: AttemptBreakdownArea | null;
  weakestArea: AttemptBreakdownArea | null;
  coachingTeaser: string | null;
  retryFocus: string | null;
  keepStableFocus: string | null;
  previousAttemptId: number | null;
  previousAttemptScore: number | null;
  previousAttemptedAt: string | null;
  scoreDeltaFromPrevious: number | null;
  poseDeltaFromPrevious: number | null;
  timingDeltaFromPrevious: number | null;
  stabilityDeltaFromPrevious: number | null;
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
  attemptVideoUrl: string | null;
  score: number;
  status: AttemptStatus;
  resultSource: AttemptResultSource;
  scoreAvailable: boolean;
  resultHeadline: string;
  resultSummary: string;
  finalFeedback: AttemptFinalFeedback | null;
  judgementTimeline: AttemptJudgementCue[];
  analyzerName: string;
  processingMode: AttemptProcessingMode | null;
  processingComplete: boolean;
  processingNotice: string | null;
  pendingTrackingId: string | null;
  videoOriginalFileName: string;
  videoContentType: string;
  videoSize: number;
  poseSimilarity: number | null;
  timingSimilarity: number | null;
  stabilitySimilarity: number | null;
  strongestArea: AttemptBreakdownArea | null;
  weakestArea: AttemptBreakdownArea | null;
  coachingTeaser: string | null;
  retryFocus: string | null;
  keepStableFocus: string | null;
  previousAttemptId: number | null;
  previousAttemptScore: number | null;
  previousAttemptedAt: string | null;
  scoreDeltaFromPrevious: number | null;
  poseDeltaFromPrevious: number | null;
  timingDeltaFromPrevious: number | null;
  stabilityDeltaFromPrevious: number | null;
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

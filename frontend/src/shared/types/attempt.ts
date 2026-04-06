export type AttemptStatus = '준비됨' | '완료됨';
export type AttemptRecordType = 'prepared' | 'completed';
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
  attemptId: number;
  challengeId: number;
  challengeTitle: string;
  score: number;
  status: AttemptStatus;
  resultSource: AttemptResultSource;
  scoreAvailable: boolean;
  resultHeadline: string;
  resultSummary: string;
  analyzerName: string;
  videoOriginalFileName: string;
  videoContentType: string;
  videoSize: number;
  attemptedAt: string;
};

export type ChallengeAnalysisStatus = 'NOT_ANALYZED' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
export type ChallengeBreakdownArea = 'pose shape' | 'pose timing' | 'detection quality';

export type ChallengeLatestRetrySummary = {
  latestAttemptId: number;
  latestScore: number;
  latestAttemptedAt: string;
  scoreDeltaFromPrevious: number | null;
  strongestArea: ChallengeBreakdownArea | null;
  weakestArea: ChallengeBreakdownArea | null;
  coachingTeaser: string | null;
  retryFocus: string | null;
  keepStableFocus: string | null;
};

export type Challenge = {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnailUrl: string | null;
  fallbackThumbnailVideoUrl: string | null;
  guideVideoUrl: string | null;
  durationSec: number;
  isActive: boolean;
  referenceAnalysisStatus: ChallengeAnalysisStatus;
  referenceVideoUploaded: boolean;
  referenceMotionProfileReady: boolean;
  referenceVideoOriginalFileName: string | null;
  referenceAnalyzedAt: string | null;
  latestRetrySummary: ChallengeLatestRetrySummary | null;
};

export type ChallengeCreateInput = {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnailUrl?: string;
  guideVideoUrl?: string;
  durationSec: number;
  referenceVideo: File;
};

export type ChallengeAnalysisResult = {
  challengeId: number;
  analysisStatus: ChallengeAnalysisStatus;
  referenceMotionProfileReady: boolean;
  analyzerName: string | null;
  analyzedAt: string | null;
  message: string;
};
export type ChallengeReferencePosePoint = {
  name: string;
  x: number;
  y: number;
  visibility: number;
};

export type ChallengeReferencePoseFrame = {
  frameIndex: number;
  points: ChallengeReferencePosePoint[];
};

export type ChallengeReferencePosePreview = {
  challengeId: number;
  challengeTitle: string;
  analyzerName: string | null;
  analyzedAt: string | null;
  referenceVideoUrl: string;
  sampleCount: number | null;
  durationMs: number | null;
  frames: ChallengeReferencePoseFrame[];
};

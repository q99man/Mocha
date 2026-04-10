export type ChallengeAnalysisStatus = 'NOT_ANALYZED' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export type Challenge = {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnailUrl: string | null;
  guideVideoUrl: string | null;
  durationSec: number;
  isActive: boolean;
  referenceAnalysisStatus: ChallengeAnalysisStatus;
  referenceVideoUploaded: boolean;
  referenceMotionProfileReady: boolean;
  referenceVideoOriginalFileName: string | null;
  referenceAnalyzedAt: string | null;
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

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

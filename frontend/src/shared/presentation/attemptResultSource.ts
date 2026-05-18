import type { AttemptResultSource } from '../types/attempt';

export function formatAttemptResultSource(value: AttemptResultSource) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '자동 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '이전 기록';
    case 'PREPARED_FLOW':
      return '준비 기록';
    default:
      return value;
  }
}

export function isLegacyAttemptResultSource(value: AttemptResultSource) {
  return value === 'SAMPLE_SCORING_PREVIEW' || value === 'PREPARED_FLOW';
}

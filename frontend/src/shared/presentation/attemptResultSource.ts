import type { AttemptResultSource } from '../types/attempt';

export function formatAttemptResultSource(value: AttemptResultSource) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '자동 채점';
    case 'NO_VIDEO_UPLOAD':
      return '영상 없음';
    default:
      return value;
  }
}

export function isVideoUploadResultSource(value: AttemptResultSource) {
  return value === 'VIDEO_UPLOAD_AUTOSCORED';
}

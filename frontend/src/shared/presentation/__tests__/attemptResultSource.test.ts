import { describe, expect, it } from 'vitest';

import { formatAttemptResultSource, isVideoUploadResultSource } from '../attemptResultSource';

describe('attempt result source presentation', () => {
  it('formats result sources for display', () => {
    expect(formatAttemptResultSource('VIDEO_UPLOAD_AUTOSCORED')).toBe('자동 채점');
    expect(formatAttemptResultSource('NO_VIDEO_UPLOAD')).toBe('영상 없음');
  });

  it('identifies upload-scored result sources', () => {
    expect(isVideoUploadResultSource('VIDEO_UPLOAD_AUTOSCORED')).toBe(true);
    expect(isVideoUploadResultSource('NO_VIDEO_UPLOAD')).toBe(false);
  });
});

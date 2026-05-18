import { describe, expect, it } from 'vitest';

import { formatAttemptResultSource, isLegacyAttemptResultSource } from '../attemptResultSource';

describe('attempt result source presentation', () => {
  it('formats current and legacy result sources for display', () => {
    expect(formatAttemptResultSource('VIDEO_UPLOAD_AUTOSCORED')).toBe('자동 채점');
    expect(formatAttemptResultSource('SAMPLE_SCORING_PREVIEW')).toBe('이전 기록');
    expect(formatAttemptResultSource('PREPARED_FLOW')).toBe('준비 기록');
  });

  it('identifies legacy result sources', () => {
    expect(isLegacyAttemptResultSource('VIDEO_UPLOAD_AUTOSCORED')).toBe(false);
    expect(isLegacyAttemptResultSource('SAMPLE_SCORING_PREVIEW')).toBe(true);
    expect(isLegacyAttemptResultSource('PREPARED_FLOW')).toBe(true);
  });
});

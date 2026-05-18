import { describe, expect, it } from 'vitest';

import { formatCompactDate, formatCompactDateTime, formatFullDateTime } from '../dateTime';

describe('dateTime presentation helpers', () => {
  it('keeps invalid date values readable', () => {
    expect(formatCompactDate('not-a-date')).toBe('not-a-date');
    expect(formatCompactDateTime('not-a-date')).toBe('not-a-date');
    expect(formatFullDateTime('not-a-date')).toBe('not-a-date');
  });

  it('formats dates with the same Korean locale options used by pages', () => {
    const value = '2026-05-18T10:20:00+09:00';
    const parsed = new Date(value);

    expect(formatCompactDate(value)).toBe(parsed.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }));
    expect(formatCompactDateTime(value)).toBe(
      parsed.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    );
    expect(formatFullDateTime(value)).toBe(
      parsed.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  });
});

import type { AttemptSummary } from '../types/attempt';

type ReplayHudTone = 'perfect' | 'good' | 'hold' | 'early' | 'late' | 'miss';

type ReplayHudCue = {
  id: number;
  second: number;
  combo: number;
  lane: number;
  verdict: 'PERFECT' | 'GOOD' | 'HOLD' | 'EARLY' | 'LATE' | 'MISS';
  label: string;
  guide: string;
  offsetMs: number;
  confidence: number;
  source: 'timeline-preview' | 'motion-analysis';
};

export type AttemptReplayHudModel = {
  tone: ReplayHudTone;
  headline: string;
  subline: string;
  cueLabel: string;
  recommendationTitle: string;
  recommendationBody: string;
  chips: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

type ReplayHudCarrier = Pick<
  AttemptSummary,
  'retryFocus' | 'keepStableFocus' | 'strongestArea' | 'weakestArea'
>;

export function buildAttemptReplayHud(
  cue: ReplayHudCue | null,
  attempt: ReplayHudCarrier,
): AttemptReplayHudModel | null {
  if (!cue) {
    return null;
  }

  const tone = cue.verdict.toLowerCase() as ReplayHudTone;
  const recommendation = buildRecommendation(cue, attempt);

  return {
    tone,
    headline: cue.label,
    subline: cue.guide,
    cueLabel: `큐 ${String(cue.id).padStart(2, '0')} · ${String(cue.second + 1).padStart(2, '0')}초`,
    recommendationTitle: recommendation.title,
    recommendationBody: recommendation.body,
    chips: [
      {
        id: 'timing',
        label: '타이밍',
        value: formatOffset(cue.offsetMs),
      },
      {
        id: 'confidence',
        label: '확신도',
        value: `${Math.round(cue.confidence * 100)}%`,
      },
      {
        id: 'combo',
        label: '콤보',
        value: cue.combo > 0 ? `${cue.combo}` : '리셋',
      },
      {
        id: 'lane',
        label: '레인',
        value: `${cue.lane + 1}`,
      },
    ],
  };
}

function buildRecommendation(cue: ReplayHudCue, attempt: ReplayHudCarrier) {
  const weakestArea = toAreaLabel(attempt.weakestArea);
  const strongestArea = toAreaLabel(attempt.strongestArea);

  switch (cue.verdict) {
    case 'PERFECT':
      return {
        title: '유지',
        body:
          attempt.keepStableFocus ??
          (strongestArea
            ? `${strongestArea} 유지`
            : '리듬 유지'),
      };
    case 'GOOD':
    case 'HOLD':
      return {
        title: '안정',
        body:
          attempt.keepStableFocus ??
          (strongestArea
            ? `${strongestArea} 유지`
            : '속도 유지'),
      };
    case 'EARLY':
      return {
        title: '늦게',
        body:
          attempt.retryFocus ??
          `${weakestArea ? weakestArea : '타이밍'} 확인`,
      };
    case 'LATE':
      return {
        title: '빠르게',
        body:
          attempt.retryFocus ??
          `${weakestArea ? weakestArea : '타이밍'} 확인`,
      };
    case 'MISS':
    default:
      return {
        title: '다시',
        body:
          attempt.retryFocus ??
          (weakestArea
            ? `${weakestArea}부터`
            : '천천히 다시'),
      };
  }
}

function toAreaLabel(area: AttemptSummary['strongestArea'] | AttemptSummary['weakestArea']) {
  if (area === 'pose shape') {
    return '포즈 형태';
  }
  if (area === 'pose timing') {
    return '포즈 타이밍';
  }
  if (area === 'detection quality') {
    return '검출 품질';
  }
  return null;
}

function formatOffset(offsetMs: number) {
  if (offsetMs === 0) {
    return '정확';
  }

  return `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
}

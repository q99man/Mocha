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
    cueLabel: `Cue ${String(cue.id).padStart(2, '0')} · ${String(cue.second + 1).padStart(2, '0')} sec`,
    recommendationTitle: recommendation.title,
    recommendationBody: recommendation.body,
    chips: [
      {
        id: 'timing',
        label: 'Timing',
        value: formatOffset(cue.offsetMs),
      },
      {
        id: 'confidence',
        label: 'Confidence',
        value: `${Math.round(cue.confidence * 100)}%`,
      },
      {
        id: 'combo',
        label: 'Combo',
        value: cue.combo > 0 ? `${cue.combo}` : 'Reset',
      },
      {
        id: 'lane',
        label: 'Lane',
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
        title: 'Keep this feeling',
        body:
          attempt.keepStableFocus ??
          (strongestArea
            ? `This cue is strongest when you trust your ${strongestArea} and avoid extra corrections.`
            : 'Keep the same rhythm and body line through the next cue.'),
      };
    case 'GOOD':
    case 'HOLD':
      return {
        title: 'Stabilize the section',
        body:
          attempt.keepStableFocus ??
          (strongestArea
            ? `The section is close. Hold the same ${strongestArea} quality through the transition.`
            : 'The cue is stable enough. Keep the same pace into the next beat.'),
      };
    case 'EARLY':
      return {
        title: 'Delay the hit slightly',
        body:
          attempt.retryFocus ??
          `Wait a fraction longer before the move lands${weakestArea ? ` and watch your ${weakestArea}` : ''}.`,
      };
    case 'LATE':
      return {
        title: 'Start a touch earlier',
        body:
          attempt.retryFocus ??
          `Prepare the motion earlier${weakestArea ? ` and tighten your ${weakestArea}` : ''} before the beat arrives.`,
      };
    case 'MISS':
    default:
      return {
        title: 'Reset this cue',
        body:
          attempt.retryFocus ??
          (weakestArea
            ? `Rebuild this section first. The miss likely starts from your ${weakestArea}.`
            : 'Slow the section down once, then rebuild the cue with a clean reset.'),
      };
  }
}

function toAreaLabel(area: AttemptSummary['strongestArea'] | AttemptSummary['weakestArea']) {
  if (area === 'pose shape') {
    return 'pose shape';
  }
  if (area === 'pose timing') {
    return 'pose timing';
  }
  if (area === 'detection quality') {
    return 'detection quality';
  }
  return null;
}

function formatOffset(offsetMs: number) {
  if (offsetMs === 0) {
    return 'On time';
  }

  return `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
}

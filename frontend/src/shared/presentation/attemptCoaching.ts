import { toAttemptBreakdownLabel } from './attemptBreakdown';
import type { AttemptSummary, AttemptVideoResult } from '../types/attempt';

type CoachingCarrier = Pick<
  AttemptSummary | AttemptVideoResult,
  | 'resultSource'
  | 'scoreAvailable'
  | 'score'
  | 'strongestArea'
  | 'weakestArea'
  | 'coachingTeaser'
  | 'scoreDeltaFromPrevious'
  | 'poseDeltaFromPrevious'
  | 'timingDeltaFromPrevious'
  | 'stabilityDeltaFromPrevious'
>;

type DeltaMetric = {
  label: string;
  delta: number;
};

export function buildAttemptCoachingTeaser(value: CoachingCarrier) {
  if (value.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !value.scoreAvailable) {
    return null;
  }

  if (value.coachingTeaser) {
    return value.coachingTeaser;
  }

  const bestMetric = buildPrimaryDeltaMetric(value, 'best');
  const worstMetric = buildPrimaryDeltaMetric(value, 'worst');

  if (value.weakestArea === 'timing') {
    return `Next retry: tighten timing first.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.weakestArea === 'detection stability') {
    return `Next retry: clean up framing before changing the move itself.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.weakestArea === 'pose similarity') {
    return `Next retry: recover the big body shapes before adjusting speed.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.score >= 85 && value.strongestArea) {
    return `Strong run overall. Keep ${toAttemptBreakdownLabel(value.strongestArea)} steady.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.scoreDeltaFromPrevious != null) {
    return `Keep the same camera setup and change one variable at a time. Score trend: ${formatSignedDelta(value.scoreDeltaFromPrevious)} pts.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  return 'Next retry: keep the same camera setup and change only one variable so the next score shift is easier to read.';
}

function buildPrimaryDeltaMetric(value: CoachingCarrier, mode: 'best' | 'worst'): DeltaMetric | null {
  const metrics = [
    buildMetric('Pose', value.poseDeltaFromPrevious),
    buildMetric('Timing', value.timingDeltaFromPrevious),
    buildMetric('Stability', value.stabilityDeltaFromPrevious),
  ].filter((metric): metric is DeltaMetric => metric !== null);

  if (metrics.length === 0) {
    return null;
  }

  const sorted = [...metrics].sort((left, right) => left.delta - right.delta);
  return mode === 'best' ? sorted[sorted.length - 1] : sorted[0];
}

function buildMetric(label: string, delta: number | null): DeltaMetric | null {
  if (delta == null) {
    return null;
  }

  return {
    label,
    delta,
  };
}

function buildDeltaTail(bestMetric: DeltaMetric | null, worstMetric: DeltaMetric | null) {
  const parts: string[] = [];

  if (bestMetric && bestMetric.delta > 0) {
    parts.push(`${bestMetric.label} improved ${formatSignedDelta(bestMetric.delta)}.`);
  }

  if (worstMetric && worstMetric.delta < 0) {
    parts.push(`${worstMetric.label} slipped ${formatSignedDelta(worstMetric.delta)}.`);
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function formatSignedDelta(delta: number) {
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

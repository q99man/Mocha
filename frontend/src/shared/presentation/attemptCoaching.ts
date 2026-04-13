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

  if (value.weakestArea === 'pose timing') {
    return `다음 재도전에서는 타이밍부터 먼저 다듬어 보세요.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.weakestArea === 'detection quality') {
    return `다음 재도전에서는 동작 자체를 바꾸기 전에 구도와 가시성부터 정리해 보세요.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.weakestArea === 'pose shape') {
    return `다음 재도전에서는 속도보다 큰 몸 모양을 먼저 회복해 보세요.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.score >= 85 && value.strongestArea) {
    return `전체적으로 좋은 결과입니다. ${toAttemptBreakdownLabel(value.strongestArea)}은 지금처럼 안정적으로 유지해 주세요.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  if (value.scoreDeltaFromPrevious != null) {
    return `카메라 세팅은 유지하고 한 번에 한 가지 변수만 바꿔 보세요. 점수 흐름: ${formatSignedDelta(value.scoreDeltaFromPrevious)}점.${buildDeltaTail(bestMetric, worstMetric)}`;
  }

  return '다음 재도전에서는 같은 카메라 세팅을 유지하고 한 가지 변수만 바꿔서 점수 변화를 더 읽기 쉽게 만들어 보세요.';
}

function buildPrimaryDeltaMetric(value: CoachingCarrier, mode: 'best' | 'worst'): DeltaMetric | null {
  const metrics = [
    buildMetric('모양', value.poseDeltaFromPrevious),
    buildMetric('타이밍', value.timingDeltaFromPrevious),
    buildMetric('품질', value.stabilityDeltaFromPrevious),
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
    parts.push(`${bestMetric.label}이 ${formatSignedDelta(bestMetric.delta)} 좋아졌습니다.`);
  }

  if (worstMetric && worstMetric.delta < 0) {
    parts.push(`${worstMetric.label}이 ${formatSignedDelta(worstMetric.delta)} 떨어졌습니다.`);
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function formatSignedDelta(delta: number) {
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

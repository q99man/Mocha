import type { AttemptBreakdownArea, AttemptSummary, AttemptVideoResult } from '../types/attempt';

type BreakdownCarrier = Pick<
  AttemptSummary | AttemptVideoResult,
  | 'resultSource'
  | 'scoreAvailable'
  | 'strongestArea'
  | 'weakestArea'
  | 'poseSimilarity'
  | 'timingSimilarity'
  | 'stabilitySimilarity'
>;

type BreakdownMetric = {
  label: string;
  value: number;
};

export function toAttemptBreakdownLabel(area: AttemptBreakdownArea) {
  switch (area) {
    case 'pose similarity':
      return 'Pose alignment';
    case 'timing':
      return 'Timing';
    case 'detection stability':
      return 'Detection stability';
  }
}

export function hasAttemptBreakdown(value: BreakdownCarrier) {
  return (
    value.resultSource === 'VIDEO_UPLOAD_AUTOSCORED' &&
    value.scoreAvailable &&
    !!(value.strongestArea || value.weakestArea)
  );
}

export function buildAttemptBreakdownSummary(value: BreakdownCarrier) {
  if (!hasAttemptBreakdown(value)) {
    return null;
  }

  const parts: string[] = [];

  if (value.strongestArea) {
    parts.push(`Strongest: ${toAttemptBreakdownLabel(value.strongestArea)}`);
  }

  if (value.weakestArea) {
    parts.push(`Watch: ${toAttemptBreakdownLabel(value.weakestArea)}`);
  }

  return parts.length > 0 ? parts.join(' / ') : null;
}

export function buildAttemptBreakdownMetrics(value: BreakdownCarrier) {
  if (!hasAttemptBreakdown(value)) {
    return [];
  }

  return [
    buildMetric('Pose', value.poseSimilarity),
    buildMetric('Timing', value.timingSimilarity),
    buildMetric('Stability', value.stabilitySimilarity),
  ].filter((metric): metric is BreakdownMetric => metric !== null);
}

function buildMetric(label: string, value: number | null): BreakdownMetric | null {
  if (value == null) {
    return null;
  }

  return {
    label,
    value,
  };
}

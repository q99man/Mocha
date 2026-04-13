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
    case 'pose shape':
      return '포즈 모양';
    case 'pose timing':
      return '포즈 타이밍';
    case 'detection quality':
      return '검출 품질';
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
    parts.push(`강점: ${toAttemptBreakdownLabel(value.strongestArea)}`);
  }

  if (value.weakestArea) {
    parts.push(`집중: ${toAttemptBreakdownLabel(value.weakestArea)}`);
  }

  return parts.length > 0 ? parts.join(' / ') : null;
}

export function buildAttemptBreakdownMetrics(value: BreakdownCarrier) {
  if (!hasAttemptBreakdown(value)) {
    return [];
  }

  return [
    buildMetric('모양', value.poseSimilarity),
    buildMetric('타이밍', value.timingSimilarity),
    buildMetric('품질', value.stabilitySimilarity),
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

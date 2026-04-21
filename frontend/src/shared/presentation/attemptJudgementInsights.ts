import type { AttemptJudgementCue } from '../types/attempt';

type InsightTone = 'good' | 'accent' | 'warning' | 'danger';

export type AttemptJudgementInsightCard = {
  id: string;
  title: string;
  value: string;
  description: string;
  tone: InsightTone;
};

export type AttemptJudgementInsights = {
  cards: AttemptJudgementInsightCard[];
  highlightCueIds: number[];
};

type CueBucket = {
  key: number;
  startSecond: number;
  endSecond: number;
  cues: AttemptJudgementCue[];
  penalty: number;
};

const WINDOW_SIZE_SECONDS = 3;

export function buildAttemptJudgementInsights(cues: AttemptJudgementCue[]): AttemptJudgementInsights {
  if (cues.length === 0) {
    return {
      cards: [],
      highlightCueIds: [],
    };
  }

  const stableCount = cues.filter((cue) => cue.verdict === 'PERFECT' || cue.verdict === 'GOOD' || cue.verdict === 'HOLD').length;
  const perfectCount = cues.filter((cue) => cue.verdict === 'PERFECT').length;
  const missCount = cues.filter((cue) => cue.verdict === 'MISS').length;
  const averageOffset = Math.round(cues.reduce((sum, cue) => sum + cue.offsetMs, 0) / Math.max(1, cues.length));
  const lateCount = cues.filter((cue) => cue.verdict === 'LATE' || cue.offsetMs >= 18).length;
  const earlyCount = cues.filter((cue) => cue.verdict === 'EARLY' || cue.offsetMs <= -18).length;
  const maxComboCue = cues.reduce((best, cue) => {
    if (!best || cue.combo > best.combo) {
      return cue;
    }
    return best;
  }, null as AttemptJudgementCue | null);
  const weakestBucket = buildWeakestBucket(cues);
  const highlightCueIds = buildHighlightCueIds(cues, weakestBucket);

  const stableRate = Math.round((stableCount / Math.max(1, cues.length)) * 100);
  const timingInsight = buildTimingInsight(averageOffset, earlyCount, lateCount, cues.length);
  const weakSectionValue =
    weakestBucket != null
      ? weakestBucket.startSecond === weakestBucket.endSecond
        ? `${padSecond(weakestBucket.startSecond)}초`
        : `${padSecond(weakestBucket.startSecond)}-${padSecond(weakestBucket.endSecond)}초`
      : '균형';
  const weakSectionDescription =
    weakestBucket != null
      ? `흔들림 ${countIssueCues(weakestBucket.cues)} / 미스 ${countMissCues(weakestBucket.cues)}`
      : '안정';
  const bestRunValue = maxComboCue && maxComboCue.combo > 0 ? `${maxComboCue.combo} 콤보` : '짧음';
  const bestRunDescription =
    maxComboCue && maxComboCue.combo > 0
      ? `${padSecond(maxComboCue.second)}초 부근 · ${maxComboCue.verdict.toLowerCase()}`
      : '아직 긴 안정 구간이 없습니다.';

  return {
    cards: [
      {
        id: 'flow-stability',
        title: '흐름',
        value: `${stableRate}%`,
        description: `퍼펙트 ${perfectCount} · 미스 ${missCount}`,
        tone: stableRate >= 80 ? 'good' : stableRate >= 60 ? 'accent' : 'warning',
      },
      {
        id: 'timing-drift',
        title: '타이밍',
        value: timingInsight.value,
        description: timingInsight.description,
        tone: timingInsight.tone,
      },
      {
        id: 'weak-section',
        title: '약한 구간',
        value: weakSectionValue,
        description: weakSectionDescription,
        tone: weakestBucket && weakestBucket.penalty >= 6 ? 'danger' : 'warning',
      },
      {
        id: 'retry-focus',
        title: '재도전',
        value: bestRunValue,
        description: buildRetryFocusDescription(timingInsight.value, weakSectionValue, bestRunDescription),
        tone: 'accent',
      },
    ],
    highlightCueIds,
  };
}

function buildTimingInsight(averageOffset: number, earlyCount: number, lateCount: number, cueCount: number) {
  if (Math.abs(averageOffset) <= 12 && Math.abs(lateCount - earlyCount) <= 1) {
    return {
      value: '균형',
      description: `평균 ${formatOffset(averageOffset)} · ${cueCount}큐`,
      tone: 'good' as const,
    };
  }

  if (averageOffset > 0 || lateCount > earlyCount) {
    return {
      value: '주로 늦음',
      description: `늦음 ${lateCount} · 평균 ${formatOffset(averageOffset)}`,
      tone: lateCount >= Math.ceil(cueCount / 3) ? ('warning' as const) : ('accent' as const),
    };
  }

  return {
    value: '주로 빠름',
    description: `빠름 ${earlyCount} · 평균 ${formatOffset(averageOffset)}`,
    tone: earlyCount >= Math.ceil(cueCount / 3) ? ('warning' as const) : ('accent' as const),
  };
}

function buildWeakestBucket(cues: AttemptJudgementCue[]) {
  const buckets = new Map<number, CueBucket>();

  for (const cue of cues) {
    const bucketKey = Math.floor(cue.second / WINDOW_SIZE_SECONDS);
    const existingBucket = buckets.get(bucketKey);
    const penalty = buildPenalty(cue);

    if (existingBucket) {
      existingBucket.cues.push(cue);
      existingBucket.penalty += penalty;
      continue;
    }

    buckets.set(bucketKey, {
      key: bucketKey,
      startSecond: bucketKey * WINDOW_SIZE_SECONDS + 1,
      endSecond: bucketKey * WINDOW_SIZE_SECONDS + WINDOW_SIZE_SECONDS,
      cues: [cue],
      penalty,
    });
  }

  return [...buckets.values()].sort((left, right) => {
    if (right.penalty !== left.penalty) {
      return right.penalty - left.penalty;
    }

    if (right.cues.length !== left.cues.length) {
      return right.cues.length - left.cues.length;
    }

    return left.key - right.key;
  })[0] ?? null;
}

function buildHighlightCueIds(cues: AttemptJudgementCue[], weakestBucket: CueBucket | null) {
  const ids = new Set<number>();
  const weakestIds = (weakestBucket?.cues ?? [])
    .slice()
    .sort((left, right) => buildPenalty(right) - buildPenalty(left))
    .slice(0, 3)
    .map((cue) => cue.id);

  for (const id of weakestIds) {
    ids.add(id);
  }

  for (const cue of cues
    .slice()
    .sort((left, right) => Math.abs(right.offsetMs) - Math.abs(left.offsetMs))
    .slice(0, 2)) {
    ids.add(cue.id);
  }

  return [...ids];
}

function buildRetryFocusDescription(timingValue: string, weakSectionValue: string, bestRunDescription: string) {
  if (timingValue === '주로 늦음') {
    return `조금 더 일찍. ${weakSectionValue}부터. ${bestRunDescription}`;
  }

  if (timingValue === '주로 빠름') {
    return `조금 더 길게. ${weakSectionValue}부터. ${bestRunDescription}`;
  }

  return `현재 중심 유지. ${weakSectionValue} 정리. ${bestRunDescription}`;
}

function buildPenalty(cue: AttemptJudgementCue) {
  switch (cue.verdict) {
    case 'MISS':
      return 4;
    case 'EARLY':
    case 'LATE':
      return 3;
    case 'GOOD':
      return 1;
    case 'HOLD':
      return 1;
    case 'PERFECT':
    default:
      return 0;
  }
}

function countIssueCues(cues: AttemptJudgementCue[]) {
  return cues.filter((cue) => cue.verdict === 'MISS' || cue.verdict === 'EARLY' || cue.verdict === 'LATE').length;
}

function countMissCues(cues: AttemptJudgementCue[]) {
  return cues.filter((cue) => cue.verdict === 'MISS').length;
}

function formatOffset(offsetMs: number) {
  if (offsetMs === 0) {
    return '0ms';
  }

  return `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
}

function padSecond(second: number) {
  return String(Math.max(1, second)).padStart(2, '0');
}

export type PlayFlowMode = 'camera' | 'test';

export type PlayJudgementTone = 'perfect' | 'good' | 'hold' | 'early' | 'late' | 'miss';

export type PlayJudgementVerdict = 'PERFECT' | 'GOOD' | 'HOLD' | 'EARLY' | 'LATE' | 'MISS';

export type PlayJudgementPlanItem = {
  id: number;
  beatIndex: number;
  second: number;
  triggerMs: number;
  windowMs: number;
  lane: number;
  accent: boolean;
};

export type PlayJudgementEvaluation = {
  verdict: PlayJudgementVerdict;
  source: 'timeline-preview' | 'motion-analysis';
  offsetMs: number;
  confidence: number;
};

export type PlayJudgementCue = PlayJudgementPlanItem & {
  combo: number;
  verdict: PlayJudgementVerdict;
  tone: PlayJudgementTone;
  label: string;
  guide: string;
  source: PlayJudgementEvaluation['source'];
  offsetMs: number;
  confidence: number;
};

const TIMELINE_PREVIEW_PATTERN: PlayJudgementVerdict[] = [
  'PERFECT',
  'GOOD',
  'EARLY',
  'PERFECT',
  'GOOD',
  'LATE',
  'PERFECT',
  'HOLD',
  'GOOD',
  'MISS',
];

const TEST_PREVIEW_PATTERN: PlayJudgementVerdict[] = [
  'GOOD',
  'EARLY',
  'GOOD',
  'PERFECT',
  'LATE',
  'GOOD',
  'HOLD',
  'GOOD',
  'PERFECT',
  'MISS',
];

const JUDGEMENT_COPY: Record<PlayJudgementVerdict, { tone: PlayJudgementTone; label: string; guide: string }> = {
  PERFECT: {
    tone: 'perfect',
    label: 'PERFECT',
    guide: '핵심 박자를 정확하게 맞춘 구간',
  },
  GOOD: {
    tone: 'good',
    label: 'GROOVE',
    guide: '흐름을 유지하며 안정적으로 연결',
  },
  HOLD: {
    tone: 'hold',
    label: 'FLOW',
    guide: '중심을 유지하며 다음 박자를 준비',
  },
  EARLY: {
    tone: 'early',
    label: 'EARLY',
    guide: '박자보다 조금 빠르게 들어간 구간',
  },
  LATE: {
    tone: 'late',
    label: 'LATE',
    guide: '박자보다 조금 늦게 반응한 구간',
  },
  MISS: {
    tone: 'miss',
    label: 'MISS',
    guide: '포인트를 놓쳐 다시 맞춰야 하는 구간',
  },
};

export function buildPlayJudgementTimeline(durationSec: number, flowMode: PlayFlowMode) {
  const safeDurationSec = Math.max(4, Math.round(durationSec));
  const intervalMs = safeDurationSec <= 20 ? 650 : safeDurationSec <= 40 ? 560 : 520;
  const leadInMs = 420;
  const eventCount = Math.max(6, Math.floor((safeDurationSec * 1000 - leadInMs) / intervalMs));
  const laneShift = flowMode === 'camera' ? 0 : 2;

  return Array.from({ length: eventCount }, (_, index) => {
    const triggerMs = leadInMs + index * intervalMs;
    const second = Math.floor(triggerMs / 1000);

    return {
      id: index + 1,
      beatIndex: index,
      second,
      triggerMs,
      windowMs: Math.round(intervalMs * 0.72),
      lane: (index + laneShift) % 6,
      accent: index % 4 === 0,
    } satisfies PlayJudgementPlanItem;
  });
}

export function buildPreviewJudgementEvaluation(
  planItem: PlayJudgementPlanItem,
  flowMode: PlayFlowMode,
): PlayJudgementEvaluation {
  const pattern = flowMode === 'camera' ? TIMELINE_PREVIEW_PATTERN : TEST_PREVIEW_PATTERN;
  const verdict = pattern[planItem.beatIndex % pattern.length];

  return {
    verdict,
    source: 'timeline-preview',
    offsetMs: buildPreviewOffset(planItem.beatIndex, verdict),
    confidence: buildPreviewConfidence(verdict),
  };
}

export function buildPlayJudgementCue(
  planItem: PlayJudgementPlanItem,
  combo: number,
  evaluation: PlayJudgementEvaluation,
): PlayJudgementCue {
  const copy = JUDGEMENT_COPY[evaluation.verdict];

  return {
    ...planItem,
    combo,
    verdict: evaluation.verdict,
    tone: copy.tone,
    label: copy.label,
    guide: copy.guide,
    source: evaluation.source,
    offsetMs: evaluation.offsetMs,
    confidence: evaluation.confidence,
  };
}

function buildPreviewOffset(beatIndex: number, verdict: PlayJudgementVerdict) {
  switch (verdict) {
    case 'PERFECT':
      return [6, -4, 8, -6][beatIndex % 4];
    case 'GOOD':
      return [22, -18, 16, -20][beatIndex % 4];
    case 'HOLD':
      return [12, -10, 14, -12][beatIndex % 4];
    case 'EARLY':
      return [-42, -36, -48][beatIndex % 3];
    case 'LATE':
      return [38, 44, 34][beatIndex % 3];
    case 'MISS':
      return [86, -92][beatIndex % 2];
    default:
      return 0;
  }
}

function buildPreviewConfidence(verdict: PlayJudgementVerdict) {
  switch (verdict) {
    case 'PERFECT':
      return 0.96;
    case 'GOOD':
      return 0.84;
    case 'HOLD':
      return 0.8;
    case 'EARLY':
    case 'LATE':
      return 0.68;
    case 'MISS':
      return 0.42;
    default:
      return 0.5;
  }
}

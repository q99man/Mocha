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

export type MotionAnalysisJudgementCue = {
  id: number;
  beatIndex: number;
  second: number;
  triggerMs: number;
  windowMs: number;
  lane: number;
  accent: boolean;
  combo: number;
  verdict: PlayJudgementVerdict;
  source: PlayJudgementEvaluation['source'];
  offsetMs: number;
  confidence: number;
};

const JUDGEMENT_COPY: Record<PlayJudgementVerdict, { tone: PlayJudgementTone; label: string; guide: string }> = {
  PERFECT: {
    tone: 'perfect',
    label: 'PERFECT',
    guide: 'Best alignment with the reference beat.',
  },
  GOOD: {
    tone: 'good',
    label: 'GROOVE',
    guide: 'Close enough to keep the flow stable.',
  },
  HOLD: {
    tone: 'hold',
    label: 'FLOW',
    guide: 'Stable hold section carried into the next beat.',
  },
  EARLY: {
    tone: 'early',
    label: 'EARLY',
    guide: 'Movement started a little ahead of the beat.',
  },
  LATE: {
    tone: 'late',
    label: 'LATE',
    guide: 'Movement reacted a little behind the beat.',
  },
  MISS: {
    tone: 'miss',
    label: 'MISS',
    guide: 'The section needs a cleaner retry.',
  },
};

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

export function buildMotionAnalysisJudgementCue(cue: MotionAnalysisJudgementCue): PlayJudgementCue {
  const copy = JUDGEMENT_COPY[cue.verdict];

  return {
    id: cue.id,
    beatIndex: cue.beatIndex,
    second: cue.second,
    triggerMs: cue.triggerMs,
    windowMs: cue.windowMs,
    lane: cue.lane,
    accent: cue.accent,
    combo: cue.combo,
    verdict: cue.verdict,
    tone: copy.tone,
    label: copy.label,
    guide: copy.guide,
    source: cue.source,
    offsetMs: cue.offsetMs,
    confidence: cue.confidence,
  };
}

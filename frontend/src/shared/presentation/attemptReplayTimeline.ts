type ReplayTimelineCue = {
  id: number;
  triggerMs: number;
  windowMs: number;
  tone: 'perfect' | 'good' | 'hold' | 'early' | 'late' | 'miss';
};

export type AttemptReplayTimelineMarker = {
  id: number;
  leftPercent: number;
  widthPercent: number;
  tone: ReplayTimelineCue['tone'];
};

export type AttemptReplayTimelineModel = {
  durationMs: number;
  playheadPercent: number;
  markers: AttemptReplayTimelineMarker[];
};

export function buildAttemptReplayTimeline(
  cues: ReplayTimelineCue[],
  playbackMs: number,
  durationMsHint: number | null,
): AttemptReplayTimelineModel | null {
  const computedDurationMs = resolveDurationMs(cues, playbackMs, durationMsHint);
  if (computedDurationMs <= 0) {
    return null;
  }

  return {
    durationMs: computedDurationMs,
    playheadPercent: clampPercent((playbackMs / computedDurationMs) * 100),
    markers: cues.map((cue) => ({
      id: cue.id,
      leftPercent: clampPercent((cue.triggerMs / computedDurationMs) * 100),
      widthPercent: Math.max(0.75, clampPercent((Math.max(cue.windowMs, 180) / computedDurationMs) * 100)),
      tone: cue.tone,
    })),
  };
}

function resolveDurationMs(cues: ReplayTimelineCue[], playbackMs: number, durationMsHint: number | null) {
  const hintedDuration = durationMsHint ?? 0;
  const lastCueMs = cues.reduce((max, cue) => Math.max(max, cue.triggerMs + cue.windowMs), 0);
  return Math.max(hintedDuration, lastCueMs + 400, playbackMs + 200, 1000);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

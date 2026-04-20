type ReplayFilterTone = 'perfect' | 'good' | 'hold' | 'early' | 'late' | 'miss';

type ReplayFilterCue = {
  id: number;
  tone: ReplayFilterTone;
};

export type AttemptReplayFilterKey = 'all' | 'highlights' | 'miss' | 'late' | 'early' | 'stable';

export type AttemptReplayFilterOption = {
  key: AttemptReplayFilterKey;
  label: string;
  predicate: (cue: ReplayFilterCue, highlightCueIds: Set<number>) => boolean;
};

export const ATTEMPT_REPLAY_FILTERS: AttemptReplayFilterOption[] = [
  {
    key: 'all',
    label: 'All',
    predicate: () => true,
  },
  {
    key: 'highlights',
    label: 'Highlights',
    predicate: (cue, highlightCueIds) => highlightCueIds.has(cue.id),
  },
  {
    key: 'miss',
    label: 'Miss',
    predicate: (cue) => cue.tone === 'miss',
  },
  {
    key: 'late',
    label: 'Late',
    predicate: (cue) => cue.tone === 'late',
  },
  {
    key: 'early',
    label: 'Early',
    predicate: (cue) => cue.tone === 'early',
  },
  {
    key: 'stable',
    label: 'Stable',
    predicate: (cue) => cue.tone === 'perfect' || cue.tone === 'good' || cue.tone === 'hold',
  },
];

export function filterAttemptReplayCues<T extends ReplayFilterCue>(
  cues: T[],
  filterKey: AttemptReplayFilterKey,
  highlightCueIds: Set<number>,
) {
  const option = ATTEMPT_REPLAY_FILTERS.find((item) => item.key === filterKey) ?? ATTEMPT_REPLAY_FILTERS[0];
  return cues.filter((cue) => option.predicate(cue, highlightCueIds));
}

export function getAttemptReplayFilterLabel(filterKey: AttemptReplayFilterKey) {
  return ATTEMPT_REPLAY_FILTERS.find((item) => item.key === filterKey)?.label ?? 'All';
}

export type DifficultyLabel = '쉬움' | '보통' | '어려움';

const DIFFICULTY_SCORE_OPTIONS: Record<DifficultyLabel, number[]> = {
  쉬움: [1, 2, 3],
  보통: [4, 5, 6, 7],
  어려움: [8, 9, 10],
};

export function getDifficultyScoreOptions(label: DifficultyLabel) {
  return DIFFICULTY_SCORE_OPTIONS[label];
}

export function composeDifficulty(label: DifficultyLabel, level: number) {
  return `${label} ${level}`;
}

export function parseDifficulty(value: string | null | undefined): { label: DifficultyLabel; level: number } {
  const normalized = value?.trim() ?? '';
  const matched = normalized.match(/(쉬움|보통|어려움)\s*(\d+)?/);

  if (matched) {
    const label = matched[1] as DifficultyLabel;
    const allowed = DIFFICULTY_SCORE_OPTIONS[label];
    const parsedLevel = matched[2] ? Number.parseInt(matched[2], 10) : Number.NaN;
    const level = allowed.includes(parsedLevel) ? parsedLevel : allowed[0];
    return { label, level };
  }

  const onlyNumber = Number.parseInt(normalized, 10);
  if (Number.isFinite(onlyNumber)) {
    if (onlyNumber <= 3) return { label: '쉬움', level: Math.min(Math.max(onlyNumber, 1), 3) };
    if (onlyNumber <= 7) return { label: '보통', level: Math.min(Math.max(onlyNumber, 4), 7) };
    return { label: '어려움', level: Math.min(Math.max(onlyNumber, 8), 10) };
  }

  return { label: '보통', level: 4 };
}

export function formatDifficulty(value: string | null | undefined) {
  const { label, level } = parseDifficulty(value);
  return `${label} ${level}`;
}

export function formatDifficultyCompact(value: string | null | undefined) {
  const { label, level } = parseDifficulty(value);
  return { label, level, text: `${label} ${level}` };
}

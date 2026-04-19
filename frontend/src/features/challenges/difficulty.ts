const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function getDifficultyOptions() {
  return [...DIFFICULTY_OPTIONS];
}

export function parseDifficulty(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampDifficulty(value);
  }

  const normalized = String(value ?? '').trim();
  const matchedNumber = normalized.match(/\d+/)?.[0];
  const parsed = Number.parseInt(matchedNumber ?? normalized, 10);

  if (Number.isFinite(parsed)) {
    return clampDifficulty(parsed);
  }

  return 5;
}

export function formatDifficulty(value: string | number | null | undefined) {
  return String(parseDifficulty(value));
}

export function formatDifficultyCompact(value: string | number | null | undefined) {
  const level = parseDifficulty(value);
  return { level, text: String(level) };
}

function clampDifficulty(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

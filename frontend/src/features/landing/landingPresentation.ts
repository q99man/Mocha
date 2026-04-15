import type { Challenge } from '../../shared/types/challenge';

export function pickFeaturedChallenge(challenges: Challenge[]) {
  const ready = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady);
  return ready[0] ?? challenges[0] ?? null;
}

export function pickShowcaseChallenges(challenges: Challenge[]) {
  const ready = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady);
  const active = challenges.filter((challenge) => challenge.isActive);
  const source = ready.length > 0 ? ready : active.length > 0 ? active : challenges;
  return source.slice(0, 4);
}

export function pickLatestScoredChallenge(challenges: Challenge[]) {
  return (
    [...challenges]
      .filter((challenge) => challenge.latestRetrySummary)
      .sort(
        (left, right) =>
          Date.parse(right.latestRetrySummary?.latestAttemptedAt ?? '') -
          Date.parse(left.latestRetrySummary?.latestAttemptedAt ?? ''),
      )[0] ?? null
  );
}

export function buildShortText(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

export function formatDeltaText(delta: number | null) {
  if (delta == null) {
    return 'No previous';
  }

  if (delta === 0) {
    return 'No change';
  }

  return `${delta > 0 ? '+' : ''}${delta}`;
}

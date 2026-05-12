import type { Challenge } from '../../shared/types/challenge';

export type LandingMetricCard = {
  label: string;
  value: string;
  meta: string;
};

export function summarizeChallenges(challenges: Challenge[]) {
  const activeChallenges = challenges.filter((challenge) => challenge.isActive);
  const readyChallenges = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady);
  const scoredChallenges = challenges.filter((challenge) => challenge.latestRetrySummary);
  const categories = [...new Set(challenges.map((challenge) => challenge.category).filter(Boolean))];
  const averageDurationSec =
    challenges.length > 0 ? Math.round(challenges.reduce((sum, challenge) => sum + challenge.durationSec, 0) / challenges.length) : 0;

  return {
    totalCount: challenges.length,
    activeCount: activeChallenges.length,
    readyCount: readyChallenges.length,
    scoredCount: scoredChallenges.length,
    categories,
    averageDurationSec,
  };
}

export function pickShowcaseChallenges(challenges: Challenge[]) {
  const ready = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady);
  const active = challenges.filter((challenge) => challenge.isActive);
  const source = ready.length > 0 ? ready : active.length > 0 ? active : challenges;
  return source.slice(0, 8);
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

export function buildLandingMetricCards(challenges: Challenge[]): LandingMetricCard[] {
  const summary = summarizeChallenges(challenges);
  const latestScoredChallenge = pickLatestScoredChallenge(challenges);
  const categoryMeta =
    summary.categories.length > 0 ? summary.categories.slice(0, 3).join(' / ') : '등록 후 자동 노출';

  return [
    {
      label: '준비 완료',
      value: String(summary.readyCount),
      meta: categoryMeta,
    },
    {
      label: '운영 중',
      value: String(summary.activeCount),
      meta: summary.totalCount > 0 ? `전체 ${summary.totalCount}개` : '등록 대기',
    },
    {
      label: '재도전',
      value: summary.scoredCount > 0 ? String(summary.scoredCount) : '0',
      meta: latestScoredChallenge?.latestRetrySummary
        ? `${latestScoredChallenge.title} ${formatDeltaText(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)}`
        : '첫 기록 대기',
    },
  ];
}

export function formatDeltaText(delta: number | null) {
  if (delta == null) {
    return '첫 기록';
  }

  if (delta === 0) {
    return '변화 없음';
  }

  return `${delta > 0 ? '+' : ''}${delta}점`;
}

import type { Challenge } from '../../shared/types/challenge';
import { formatDeltaText } from './landingPresentation';

type LandingUseCaseSectionProps = {
  readyCount: number;
  latestScoredChallenge: Challenge | null;
};

export function LandingUseCaseSection({ readyCount, latestScoredChallenge }: LandingUseCaseSectionProps) {
  const cards = [
    {
      label: 'Use case 01',
      title: '고르고 바로 시작',
      meta: readyCount > 0 ? `${readyCount} ready` : 'Ready soon',
    },
    {
      label: 'Use case 02',
      title: '기준 영상과 비교',
      meta: 'Reference match',
    },
    {
      label: 'Use case 03',
      title: latestScoredChallenge?.title ?? '기록 기반 재도전',
      meta: latestScoredChallenge?.latestRetrySummary
        ? `${latestScoredChallenge.latestRetrySummary.latestScore}점 / ${formatDeltaText(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)}`
        : 'First record',
    },
  ];

  return (
    <section className="lp-section lp-section--light" id="use-case">
      <div className="lp-section__header lp-section__header--light">
        <span className="lp-kicker lp-kicker--dark">Use case</span>
        <h3>실제 사용 장면에 맞춘 흐름.</h3>
      </div>

      <div className="lp-usecase-grid">
        {cards.map((card) => (
          <article className="lp-usecase-grid__card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.title}</strong>
            <div className="lp-meta-row">
              <span>{card.meta}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

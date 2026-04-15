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
      title: '짧게 고르고 바로 진입',
      body: `${readyCount > 0 ? `${readyCount}개의 준비된 챌린지` : '준비된 챌린지'}를 중심으로 시작 흐름까지 빠르게 이어집니다.`,
    },
    {
      label: 'Use case 02',
      title: '기준 동작과 비교',
      body: '업로드 이후에는 비교와 결과 확인까지 같은 리듬 안에서 이어집니다.',
    },
    {
      label: 'Use case 03',
      title: latestScoredChallenge?.title ?? '기록 기반 재도전',
      body: latestScoredChallenge?.latestRetrySummary
        ? `최근 점수 ${latestScoredChallenge.latestRetrySummary.latestScore} / ${formatDeltaText(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)} 흐름으로 다음 시도의 기준을 만듭니다.`
        : '첫 기록부터 결과와 흐름이 쌓여 다음 도전의 기준이 됩니다.',
    },
  ];

  return (
    <section className="lp-section lp-section--light" id="use-case">
      <div className="lp-section__header lp-section__header--light">
        <span className="lp-kicker lp-kicker--dark">Use case</span>
        <h3>실제 제품 흐름에서 나온 사용 장면.</h3>
        <p>가짜 후기가 아니라 실제 사용 루프를 카드로 정리했습니다.</p>
      </div>

      <div className="lp-usecase-grid">
        {cards.map((card) => (
          <article className="lp-usecase-grid__card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

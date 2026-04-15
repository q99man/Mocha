import { Link } from 'react-router-dom';
import { ChallengeVisual } from '../challenges/ChallengeVisual';
import type { Challenge } from '../../shared/types/challenge';
import { buildShortText, formatDeltaText } from './landingPresentation';

type LandingHeroProps = {
  featuredChallenge: Challenge | null;
  showcaseChallenges: Challenge[];
  latestScoredChallenge: Challenge | null;
  totalCount: number;
  readyCount: number;
  isAuthenticated: boolean;
  loading: boolean;
};

export function LandingHero({
  featuredChallenge,
  showcaseChallenges,
  latestScoredChallenge,
  totalCount,
  readyCount,
  isAuthenticated,
  loading,
}: LandingHeroProps) {
  return (
    <section className="lp-hero">
      <div className="lp-hero__copy">
        <span className="lp-kicker">Motion challenge platform</span>
        <h2>Take control of motion practice.</h2>
        <p>챌린지를 고르고, 기준 동작과 비교하고, 다시 도전하는 흐름을 더 짧고 자연스럽게 정리했습니다.</p>
        <div className="lp-actions">
          <Link className="lp-button" to={isAuthenticated ? '/challenges' : '/auth'}>
            Get started
          </Link>
          <a className="lp-button lp-button--ghost" href="#showcase">
            Browse tracks
          </a>
        </div>
      </div>

      <div className="lp-board">
        <div className="lp-board__topbar">
          <span className="lp-board__brand">Mocha.</span>
          <div className="lp-board__search">Search challenge</div>
          <div className="lp-board__meta">
            <span>{loading ? 'Syncing' : 'Ready'}</span>
            <span>{readyCount} live</span>
          </div>
        </div>

        <div className="lp-board__grid">
          <article className="lp-panel lp-panel--rail">
            <span className="lp-panel__label">Library</span>
            <strong>{String(totalCount).padStart(2, '0')}</strong>
            <p>준비된 트랙부터 우선 보여주고 바로 시작 흐름으로 연결합니다.</p>
            <div className="lp-chip-stack">
              {showcaseChallenges.slice(0, 3).map((challenge) => (
                <span key={challenge.id}>{challenge.title}</span>
              ))}
            </div>
          </article>

          <article className="lp-panel lp-panel--feature">
            <div className="lp-panel__heading">
              <span className="lp-panel__label">Featured</span>
              <span className="lp-panel__status">{featuredChallenge?.referenceMotionProfileReady ? 'Ready' : 'Soon'}</span>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-card__visual">
                {featuredChallenge ? (
                  <ChallengeVisual
                    title={featuredChallenge.title}
                    thumbnailUrl={featuredChallenge.thumbnailUrl}
                    fallbackThumbnailVideoUrl={featuredChallenge.fallbackThumbnailVideoUrl}
                    className="lp-feature-card__image"
                    placeholderClassName="lp-feature-card__image lp-feature-card__image--placeholder"
                  />
                ) : (
                  <div className="lp-feature-card__image lp-feature-card__image--placeholder">COMING UP</div>
                )}
              </div>
              <div className="lp-feature-card__body">
                <strong>{featuredChallenge?.title ?? 'Featured challenge'}</strong>
                <p>{featuredChallenge ? buildShortText(featuredChallenge.description, 96) : '대표 챌린지를 준비 중입니다.'}</p>
                {featuredChallenge ? (
                  <Link className="lp-inline-link" to={`/challenges/${featuredChallenge.id}`}>
                    Open challenge
                  </Link>
                ) : null}
              </div>
            </div>
          </article>

          <article className="lp-panel lp-panel--signal">
            <span className="lp-panel__label">Latest signal</span>
            <strong>
              {latestScoredChallenge?.latestRetrySummary ? `${latestScoredChallenge.latestRetrySummary.latestScore} pts` : 'No score'}
            </strong>
            <p>
              {latestScoredChallenge?.latestRetrySummary
                ? `${latestScoredChallenge.title} / ${formatDeltaText(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)}`
                : '첫 기록이 쌓이면 최근 흐름을 여기서 바로 확인할 수 있습니다.'}
            </p>
            <div className="lp-signal-list">
              <div>
                <span>Pick</span>
                <small>챌린지 선택</small>
              </div>
              <div>
                <span>Match</span>
                <small>기준 동작 비교</small>
              </div>
              <div>
                <span>Retry</span>
                <small>다시 도전</small>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

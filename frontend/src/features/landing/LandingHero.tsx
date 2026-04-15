import { Link } from 'react-router-dom';
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
        <h2>Match the move. Keep the rhythm.</h2>
        <div className="lp-actions">
          <Link className="lp-button" to={isAuthenticated ? '/challenges' : '/auth'}>
            Start now
          </Link>
          <a className="lp-button lp-button--ghost" href="#showcase">
            View gallery
          </a>
        </div>
      </div>

      <div className="lp-stage">
        <article className="lp-stage__featured">
          <div className="lp-stage__featured-body">
            <div className="lp-stage__eyebrow-row">
              <span className="lp-panel__label">Featured track</span>
              <span className="lp-panel__status">{featuredChallenge?.referenceMotionProfileReady ? 'Ready' : 'Preparing'}</span>
            </div>
            <strong>{featuredChallenge?.title ?? 'Next featured challenge'}</strong>
            <div className="lp-meta-row">
              <span>{loading ? 'Syncing library' : `${readyCount} ready now`}</span>
              <span>{totalCount} total tracks</span>
            </div>
            {featuredChallenge ? (
              <Link className="lp-inline-link" to={`/challenges/${featuredChallenge.id}`}>
                Open challenge
              </Link>
            ) : null}
          </div>
        </article>

        <div className="lp-stage__rail">
          <article className="lp-panel lp-panel--compact">
            <span className="lp-panel__label">Quick flow</span>
            <strong>Pick. Match. Retry.</strong>
            <div className="lp-chip-stack">
              {showcaseChallenges.slice(0, 3).map((challenge) => (
                <span key={challenge.id}>{challenge.title}</span>
              ))}
            </div>
          </article>

          <article className="lp-panel lp-panel--compact">
            <span className="lp-panel__label">Latest score</span>
            <strong>
              {latestScoredChallenge?.latestRetrySummary ? `${latestScoredChallenge.latestRetrySummary.latestScore}점` : '기록 대기'}
            </strong>
            {latestScoredChallenge?.latestRetrySummary ? (
              <div className="lp-meta-row">
                <span>{latestScoredChallenge.title}</span>
                <span>{formatDeltaText(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)}</span>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}

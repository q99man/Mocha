import { Link } from 'react-router-dom';

import type { Challenge } from '../../shared/types/challenge';
import { formatDifficulty } from '../challenges/difficulty';
import { ChallengeVisual } from '../challenges/ChallengeVisual';

type LandingShowcaseSectionProps = {
  challenges: Challenge[];
};

export function LandingShowcaseSection({ challenges }: LandingShowcaseSectionProps) {
  const hasLoop = challenges.length > 1;
  const trackChallenges = hasLoop ? [...challenges, ...challenges] : challenges;

  return (
    <section className="lp-section lp-section--showcase" id="showcase">
      <div className="lp-section__header">
        <span className="lp-kicker">Challenge</span>
      </div>

      <div className="lp-showcase">
        {challenges.length > 0 ? (
          <div className="lp-showcase__viewport">
            <div className={`lp-showcase__track${hasLoop ? ' lp-showcase__track--marquee' : ''}`}>
              {trackChallenges.map((challenge, index) => (
                <Link
                  className="lp-showcase__card lp-panel-glass"
                  to="/challenges"
                  key={`${challenge.id}-${index < challenges.length ? 'base' : 'clone'}`}
                  aria-hidden={hasLoop && index >= challenges.length}
                >
                  <div className="lp-showcase__card-media">
                    <ChallengeVisual
                      title={challenge.title}
                      thumbnailUrl={challenge.thumbnailUrl}
                      fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
                      className="lp-showcase__card-image"
                      placeholderClassName="lp-showcase__placeholder"
                      videoAutoPlay
                    />
                  </div>
                  <div className="lp-showcase__card-body">
                    <span className="lp-showcase__badge">{challenge.category}</span>
                    <strong className="lp-showcase__title lp-showcase__title--mini">{challenge.title}</strong>
                    <div className="lp-meta-row">
                      <span>{formatDifficulty(challenge.difficulty)}</span>
                      <span>{challenge.durationSec}초</span>
                      <span>{challenge.referenceMotionProfileReady ? '준비 완료' : '처리 중'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <article className="lp-showcase__card lp-showcase__card--empty lp-panel-glass">
            <strong>곧 공개됩니다</strong>
          </article>
        )}
      </div>
    </section>
  );
}

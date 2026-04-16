import { Link } from 'react-router-dom';
import { ChallengeVisual } from '../challenges/ChallengeVisual';
import type { Challenge } from '../../shared/types/challenge';

type LandingShowcaseSectionProps = {
  challenges: Challenge[];
};

export function LandingShowcaseSection({ challenges }: LandingShowcaseSectionProps) {
  const hasLoop = challenges.length > 1;
  const trackChallenges = hasLoop ? [...challenges, ...challenges] : challenges;

  return (
    <section className="lp-section lp-section--showcase" id="showcase">
      <div className="lp-section__header">
        <span className="lp-kicker">Showcase</span>
      </div>

      <div className="lp-showcase">
        {challenges.length > 0 ? (
          <div className="lp-showcase__viewport">
            <div className={`lp-showcase__track${hasLoop ? ' lp-showcase__track--marquee' : ''}`}>
              {trackChallenges.map((challenge, index) => (
                <Link
                  className="lp-showcase__card lp-panel-glass"
                  to={`/challenges/${challenge.id}`}
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
                      <span>{challenge.difficulty}</span>
                      <span>{challenge.durationSec} sec</span>
                      <span>{challenge.referenceMotionProfileReady ? 'ready' : 'processing'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <article className="lp-showcase__card lp-showcase__card--empty lp-panel-glass">
            <strong>등록된 챌린지가 아직 없습니다.</strong>
          </article>
        )}
      </div>
    </section>
  );
}

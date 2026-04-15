import { Link } from 'react-router-dom';
import { ChallengeVisual } from '../challenges/ChallengeVisual';
import type { Challenge } from '../../shared/types/challenge';
import { buildShortText } from './landingPresentation';

type LandingShowcaseSectionProps = {
  challenges: Challenge[];
};

export function LandingShowcaseSection({ challenges }: LandingShowcaseSectionProps) {
  const primary = challenges[0] ?? null;
  const secondary = challenges.slice(1, 4);

  return (
    <section className="lp-section lp-section--showcase" id="showcase">
      <div className="lp-section__header">
        <span className="lp-kicker">Showcase</span>
        <h3>Mocha 데이터로 다시 만든 챌린지 갤러리.</h3>
        <p>레퍼런스의 리듬만 참고하고, 실제 카드와 정보는 제품 데이터로 재구성했습니다.</p>
      </div>

      <div className="lp-showcase">
        <div className="lp-showcase__lead">
          {primary ? (
            <article className="lp-showcase__primary-card">
              <div className="lp-showcase__primary-media">
                <ChallengeVisual
                  title={primary.title}
                  thumbnailUrl={primary.thumbnailUrl}
                  fallbackThumbnailVideoUrl={primary.fallbackThumbnailVideoUrl}
                  className="lp-showcase__primary-image"
                  placeholderClassName="lp-showcase__primary-image lp-showcase__primary-image--placeholder"
                />
              </div>
              <div className="lp-showcase__primary-body">
                <span>Lead track</span>
                <strong>{primary.title}</strong>
                <p>{buildShortText(primary.description, 112)}</p>
                <div className="lp-meta-row">
                  <span>{primary.category}</span>
                  <span>{primary.difficulty}</span>
                  <span>{primary.durationSec} sec</span>
                </div>
                <Link className="lp-inline-link" to={`/challenges/${primary.id}`}>
                  Open track
                </Link>
              </div>
            </article>
          ) : (
            <article className="lp-showcase__primary-card lp-showcase__primary-card--empty">
              <strong>챌린지를 불러오는 중입니다.</strong>
              <p>대표 트랙이 준비되면 이 영역에 먼저 표시됩니다.</p>
            </article>
          )}
        </div>

        <div className="lp-showcase__stack">
          {secondary.map((challenge) => (
            <article className="lp-showcase__mini-card" key={challenge.id}>
              <div className="lp-showcase__mini-media">
                <ChallengeVisual
                  title={challenge.title}
                  thumbnailUrl={challenge.thumbnailUrl}
                  fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
                  className="lp-showcase__mini-image"
                  placeholderClassName="lp-showcase__mini-image lp-showcase__mini-image--placeholder"
                />
              </div>
              <div className="lp-showcase__mini-body">
                <strong>{challenge.title}</strong>
                <p>{buildShortText(challenge.description, 72)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

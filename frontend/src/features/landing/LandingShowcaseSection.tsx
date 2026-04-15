import { Link } from 'react-router-dom';
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
        <h3>지금 바로 들어갈 수 있는 트랙.</h3>
      </div>

      <div className="lp-showcase">
        <div className="lp-showcase__lead">
          {primary ? (
            <article className="lp-showcase__primary-card">
              <div className="lp-showcase__primary-body">
                <span>Lead track</span>
                <strong>{primary.title}</strong>
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
              <strong>챌린지 라이브러리를 불러오는 중입니다.</strong>
            </article>
          )}
        </div>

        <div className="lp-showcase__stack">
          {secondary.map((challenge) => (
            <article className="lp-showcase__mini-card" key={challenge.id}>
              <div className="lp-showcase__mini-body">
                <strong>{challenge.title}</strong>
                <div className="lp-meta-row">
                  <span>{challenge.category}</span>
                  <span>{challenge.difficulty}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

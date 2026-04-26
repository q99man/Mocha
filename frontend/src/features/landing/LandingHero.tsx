import { Link, useLocation } from 'react-router-dom';

import { buildAuthModalHref } from '../../shared/auth/authModalUtils';

type LandingHeroProps = {
  isAuthenticated: boolean;
};

export function LandingHero({ isAuthenticated }: LandingHeroProps) {
  const location = useLocation();

  return (
    <section className="lp-hero">
      <div className="lp-hero-scene" aria-hidden="true">
        <div className="lp-hero-scene__card lp-hero-scene__card--motion">
          <div className="lp-hero-card__topline">
            <span>Motion</span>
            <strong>LIVE</strong>
          </div>
          <div className="lp-motion-stage">
            <div className="lp-motion-stage__ring" />
            <div className="lp-dancer">
              <span className="lp-dancer__head" />
              <span className="lp-dancer__body" />
              <span className="lp-dancer__arm lp-dancer__arm--left" />
              <span className="lp-dancer__arm lp-dancer__arm--right" />
              <span className="lp-dancer__leg lp-dancer__leg--left" />
              <span className="lp-dancer__leg lp-dancer__leg--right" />
            </div>
          </div>
          <div className="lp-hero-card__caption">
            <strong>Catch the move</strong>
            <span>박자에 맞춰 움직임을 따라갑니다.</span>
          </div>
        </div>

        <div className="lp-hero-scene__card lp-hero-scene__card--phone">
          <div className="lp-phone-frame">
            <div className="lp-phone-frame__screen">
              <div className="lp-camera-grid" />
              <div className="lp-camera-person">
                <span />
                <strong />
              </div>
              <div className="lp-camera-rec">REC</div>
              <div className="lp-score-chip">
                <span>Score</span>
                <strong>86</strong>
              </div>
            </div>
          </div>
          <div className="lp-score-stack">
            <span className="lp-score-stack__pill">Perfect +12</span>
            <span className="lp-score-stack__pill">Timing 91%</span>
            <span className="lp-score-stack__pill">Camera ready</span>
          </div>
        </div>
      </div>

      <div className="lp-hero__copy">
        <span className="lp-kicker">Mocha Challenge</span>
        <h2>
          카메라로 따라하고
          <span>도전해 보세요</span>
        </h2>
        <p>춤추고, 찍고, 점수로 확인하는 모션 챌린지.</p>
        <div className="lp-actions">
          <Link className="lp-button" to={isAuthenticated ? '/challenges' : buildAuthModalHref(location, { redirectPath: '/' })}>
            시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}

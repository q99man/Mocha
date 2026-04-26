import { Link, useLocation } from 'react-router-dom';

import { buildAuthModalHref } from '../../shared/auth/authModalUtils';

type LandingHeroProps = {
  isAuthenticated: boolean;
};

export function LandingHero({ isAuthenticated }: LandingHeroProps) {
  const location = useLocation();

  return (
    <section className="lp-hero">
      <div className="lp-hero-content">
        <div className="lp-mobile-hero-frame" aria-hidden="true">
          <div className="lp-mobile-hero-track">
            <img src="/landing/mobile-hero-1.png" alt="" className="lp-mobile-hero-image" />
            <img src="/landing/mobile-hero-2.png" alt="" className="lp-mobile-hero-image" />
          </div>
        </div>

        <div className="lp-hero__copy">
          <span className="lp-hero__eyebrow">Motion Challenge</span>
          <h2>모션 챌린지 도전해 보세요</h2>
          <div className="lp-actions">
            <Link className="lp-button" to={isAuthenticated ? '/challenges' : buildAuthModalHref(location, { redirectPath: '/' })}>
              시작하기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

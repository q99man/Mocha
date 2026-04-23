import { Link, useLocation } from 'react-router-dom';

import { buildAuthModalHref } from '../../shared/auth/authModalUtils';

type LandingHeroProps = {
  isAuthenticated: boolean;
};

export function LandingHero({ isAuthenticated }: LandingHeroProps) {
  const location = useLocation();

  return (
    <section className="lp-hero">
      <div className="lp-hero__copy">
        <h2>모션 챌린지</h2>
        <div className="lp-actions">
          <Link className="lp-button" to={isAuthenticated ? '/challenges' : buildAuthModalHref(location, { redirectPath: '/challenges' })}>
            시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}

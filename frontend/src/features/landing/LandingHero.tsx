import { Link } from 'react-router-dom';

type LandingHeroProps = {
  isAuthenticated: boolean;
};

export function LandingHero({ isAuthenticated }: LandingHeroProps) {
  return (
    <section className="lp-hero">
      <div className="lp-hero__copy">
        <h2>모션 챌린지</h2>
        <div className="lp-actions">
          <Link className="lp-button" to={isAuthenticated ? '/challenges' : '/auth'}>
            지금 시작하기
          </Link>
          <a className="lp-button lp-button--ghost" href="#showcase">
            챌린지 보기
          </a>
        </div>
      </div>
    </section>
  );
}

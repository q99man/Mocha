import { Link } from 'react-router-dom';

export function LandingCtaSection() {
  return (
    <section className="lp-section">
      <div className="lp-cta">
        <div className="lp-cta__content">
          <span className="lp-kicker">CTA</span>
          <h3>한 번 고르고, 바로 시작하면 됩니다.</h3>
          <p>챌린지를 둘러보고 기준 동작과 비교한 뒤, 다음 점수를 만들어 보세요.</p>
          <div className="lp-actions">
            <Link className="lp-button" to="/challenges">
              Get started
            </Link>
            <Link className="lp-button lp-button--ghost" to="/attempts">
              Recent archive
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

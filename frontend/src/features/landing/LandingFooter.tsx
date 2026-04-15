import { Link } from 'react-router-dom';

type LandingFooterProps = {
  isAuthenticated: boolean;
};

export function LandingFooter({ isAuthenticated }: LandingFooterProps) {
  return (
    <footer className="lp-footer" id="footer">
      <div className="lp-footer__top">
        <div className="lp-footer__brand">
          <span>Mocha</span>
        </div>

        <div className="lp-footer__links">
          <div>
            <strong>Product</strong>
            <Link to="/challenges">Challenges</Link>
            <Link to="/attempts">Archive</Link>
          </div>
          <div>
            <strong>Sections</strong>
            <a href="#feature">Feature</a>
            <a href="#showcase">Showcase</a>
          </div>
          <div>
            <strong>Start</strong>
            <Link to={isAuthenticated ? '/challenges' : '/auth'}>Start now</Link>
            <a href="#cta">CTA</a>
          </div>
        </div>
      </div>

      <div className="lp-footer__wordmark">MOCHA</div>
    </footer>
  );
}

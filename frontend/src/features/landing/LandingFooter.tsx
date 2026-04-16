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
            <strong>제품</strong>
            <Link to="/challenges">챌린지</Link>
            <Link to="/attempts">기록 보관소</Link>
          </div>
          <div>
            <strong>섹션</strong>
            <a href="#showcase">쇼케이스</a>
          </div>
          <div>
            <strong>시작하기</strong>
            <Link to={isAuthenticated ? '/challenges' : '/auth'}>지금 시작하기</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

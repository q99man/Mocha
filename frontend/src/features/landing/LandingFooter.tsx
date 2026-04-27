export function LandingFooter() {
  return (
    <footer className="lp-footer" id="footer">
      <div className="lp-footer__top">
        <div className="lp-footer__brand">
          <span>Mocha</span>
          <p>도전하고 기록하는 챌린지 플랫폼</p>
          <p className="lp-footer__copyright">© 2026 Mocha. All rights reserved.</p>
        </div>

        <div className="lp-footer__links">
          <div>
            <strong>오시는 길</strong>
            <p>인천시 부평구 경원대로 1366</p>
            <p>스테이션타워 7층 702호</p>
          </div>
          <div>
            <strong>문의</strong>
            <p>q99man@gmail.com</p>
            <p>평일 10:00 - 18:00</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer" id="footer">
      <div className="lp-footer__top">
        <div className="lp-footer__brand">
          <span>Mocha</span>
          <p>몸으로 기록하고, 함께 성장하는 모션 챌린지 플랫폼</p>
          <p className="lp-footer__copyright">© 2026 Mocha. All rights reserved.</p>
        </div>

        <div className="lp-footer__links">
          <div>
            <strong>오시는 길</strong>
            <p>서울특별시 강남구 테헤란로 123</p>
            <p>Mocha Studio 4F</p>
          </div>
          <div>
            <strong>문의</strong>
            <p>hello@mocha.fit</p>
            <p>평일 10:00 - 18:00</p>
          </div>
          <div>
            <strong>안내</strong>
            <p>서비스 소개 · 이용약관 · 개인정보 처리방침</p>
            <p>준비 중인 메뉴는 순차적으로 연결됩니다.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

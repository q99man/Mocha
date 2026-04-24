import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { AuthModal } from '../auth/AuthModal';
import {
  buildAuthModalHref,
  buildPathWithSearch,
  resolveAuthFeedback,
  resolveAuthMode,
  sanitizeAuthRedirectPath,
  stripAuthModalSearch,
  type AuthMode,
} from '../auth/authModalUtils';
import { CompactConfirmDialog } from './CompactConfirmDialog';
import { CompactToast } from './CompactToast';

const BASE_NAV_ITEMS = [
  { to: '/', label: '홈' },
  { to: '/challenges', label: '챌린지' },
  { to: '/board', label: '게시판' },
];

type LayoutToast = {
  message: string;
  type: 'success' | 'error';
};

type LayoutLocationState = {
  compactToast?: LayoutToast;
} | null;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  const isLandingRoute = location.pathname === '/';
  const authParams = new URLSearchParams(location.search);
  const authMode = resolveAuthMode(authParams.get('auth'));
  const authRedirect = sanitizeAuthRedirectPath(authParams.get('redirect'));
  const authFeedback = resolveAuthFeedback(authParams);
  const isImmersivePlayRoute =
    (location.pathname.startsWith('/challenges/') && location.pathname.endsWith('/start')) ||
    (location.pathname.startsWith('/attempts/') && location.pathname.endsWith('/result'));
  const [isLandingTopbarScrolled, setIsLandingTopbarScrolled] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [layoutToast, setLayoutToast] = useState<LayoutToast | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isAuthenticated && !isAdmin ? [{ to: '/mypage', label: '마이페이지' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: '관리' }] : []),
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('body--play-fullscreen', isImmersivePlayRoute);

    if (!isLandingRoute) {
      setIsLandingTopbarScrolled(false);
      return () => {
        document.body.classList.remove('body--play-fullscreen');
      };
    }

    const updateLandingTopbar = () => {
      setIsLandingTopbarScrolled(window.scrollY > 28);
    };

    updateLandingTopbar();
    window.addEventListener('scroll', updateLandingTopbar, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateLandingTopbar);
      document.body.classList.remove('body--play-fullscreen');
    };
  }, [isImmersivePlayRoute, isLandingRoute]);

  useEffect(() => {
    const compactToast = (location.state as LayoutLocationState)?.compactToast;
    if (!compactToast) {
      return;
    }

    setLayoutToast(compactToast);
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state: null },
    );
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  async function handleLogout() {
    if (logoutBusy) {
      return;
    }

    setLogoutBusy(true);

    try {
      await logout();
      setLogoutConfirmOpen(false);
      navigate('/', {
        replace: true,
        state: {
          compactToast: {
            message: '로그아웃되었습니다.',
            type: 'success',
          },
        },
      });
    } catch {
      setLogoutConfirmOpen(false);
      setLayoutToast({
        message: '로그아웃 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        type: 'error',
      });
    } finally {
      setLogoutBusy(false);
    }
  }

  function closeAuthModal() {
    navigate(
      {
        pathname: location.pathname,
        search: stripAuthModalSearch(location.search),
      },
      { replace: true },
    );
  }

  const mobileMenuOverlay = (
    <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'is-open' : ''}`}>
      <div className="mobile-menu-overlay__backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      <div className="mobile-menu-overlay__panel">
        <div className="mobile-menu-overlay__header">
          <strong>Mocha</strong>
          <button type="button" onClick={() => setIsMobileMenuOpen(false)} aria-label="메뉴 닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <nav className="mobile-menu-overlay__nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu-overlay__actions">
          {isAuthenticated ? (
            <>
              <span className="mobile-menu-overlay__account">{user?.displayName ?? '사용자'}</span>
              <button
                className="stage-nav__utility"
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setLogoutConfirmOpen(true);
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              className="stage-nav__cta"
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate(buildAuthModalHref(location, { redirectPath: buildPathWithSearch(location.pathname, location.search) }));
              }}
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const logoutConfirmDialog = (
    <CompactConfirmDialog
      open={logoutConfirmOpen}
      title="로그아웃할까요?"
      description="현재 계정에서 로그아웃하고 홈 화면으로 이동합니다."
      confirmLabel="로그아웃"
      cancelLabel="취소"
      tone="danger"
      busy={logoutBusy}
      onConfirm={handleLogout}
      onCancel={() => setLogoutConfirmOpen(false)}
    />
  );

  const layoutToastElement = (
    <CompactToast
      message={layoutToast?.message ?? null}
      type={layoutToast?.type ?? 'success'}
      onClose={() => setLayoutToast(null)}
    />
  );

  return (
    <>
      {isLandingRoute ? (
        <div className="stage-shell stage-shell--landing">
          <header className={`stage-topbar stage-topbar--landing${isLandingTopbarScrolled ? ' is-scrolled' : ''}`}>
            <Link className="stage-topbar__brand stage-topbar__brand--landing" to="/">
              <div className="stage-topbar__title-row stage-topbar__title-row--landing">
                <h1>Mocha</h1>
              </div>
            </Link>

            <button
              className="mobile-menu-trigger"
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="메뉴 열기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>

            <div className="stage-topbar__actions stage-topbar__actions--landing">
              {isAdmin ? (
                <NavLink className="stage-nav__utility" to="/admin">
                  관리자
                </NavLink>
              ) : null}
              {isAuthenticated && !isAdmin ? (
                <NavLink className="stage-nav__utility" to="/mypage">
                  마이페이지
                </NavLink>
              ) : null}
              {isAuthenticated ? (
                <button
                  className="stage-nav__utility"
                  type="button"
                  onClick={() => setLogoutConfirmOpen(true)}
                  disabled={logoutBusy}
                >
                  로그아웃
                </button>
              ) : (
                <NavLink className="stage-nav__cta" to={buildAuthModalHref(location, { redirectPath: location.pathname })}>
                  로그인
                </NavLink>
              )}
            </div>
          </header>

          <main className="stage-main stage-main--landing">
            <Outlet />
          </main>


        </div>
      ) : (
        <div className="app-shell app-shell--glass">
          <div className="app-shell__ambient" aria-hidden="true" />

          {!isImmersivePlayRoute ? (
            <header className="app-header-glass">
              <Link className="app-header-glass__brand" to="/">
                <strong>Mocha</strong>
              </Link>

              <button
                className="mobile-menu-trigger"
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="메뉴 열기"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>

              <nav className="app-header-glass__nav" aria-label="주요 메뉴">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="app-header-glass__actions">
                {isAuthenticated ? (
                  <>
                    <span className="app-header-glass__account">{user?.displayName ?? '사용자'}</span>
                    <button
                      className="stage-nav__utility"
                      type="button"
                      onClick={() => setLogoutConfirmOpen(true)}
                      disabled={logoutBusy}
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <button
                    className="stage-nav__cta"
                    type="button"
                    onClick={() =>
                      navigate(buildAuthModalHref(location, { redirectPath: buildPathWithSearch(location.pathname, location.search) }))
                    }
                  >
                    로그인
                  </button>
                )}
              </div>
            </header>
          ) : null}

          <main className="app-main-glass">
            <Outlet />
          </main>


        </div>
      )}

      {layoutToastElement}
      {logoutConfirmDialog}
      {mobileMenuOverlay}
      {authMode ? (
        <AuthModal
          mode={authMode}
          redirectTarget={authRedirect}
          feedback={authFeedback}
          onClose={closeAuthModal}
          onModeChange={(nextMode: AuthMode) => {
            navigate(buildAuthModalHref(location, { mode: nextMode, redirectPath: authRedirect }), { replace: true });
          }}
        />
      ) : null}
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { AuthModal } from '../auth/AuthModal';
import {
  buildAuthModalHref,
  resolveAuthFeedback,
  resolveAuthMode,
  sanitizeAuthRedirectPath,
  stripAuthModalSearch,
  type AuthMode,
} from '../auth/authModalUtils';

const BASE_NAV_ITEMS = [
  { to: '/', label: '홈' },
  { to: '/challenges', label: '챌린지' },
  { to: '/board', label: '게시판' },
];

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

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isAuthenticated && !isAdmin ? [{ to: '/mypage', label: '마이페이지' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: '관리' }] : []),
  ];

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

  async function handleLogout() {
    if (logoutBusy) {
      return;
    }

    setLogoutBusy(true);

    try {
      await logout();
      navigate('/', { replace: true });
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

  if (isLandingRoute) {
    return (
      <div className="stage-shell stage-shell--landing">
        <header className={`stage-topbar stage-topbar--landing${isLandingTopbarScrolled ? ' is-scrolled' : ''}`}>
          <Link className="stage-topbar__brand stage-topbar__brand--landing" to="/">
            <div className="stage-topbar__title-row stage-topbar__title-row--landing">
              <h1>Mocha</h1>
            </div>
          </Link>

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
                onClick={() => void handleLogout()}
                disabled={logoutBusy}
              >
                로그아웃
              </button>
            ) : (
              <NavLink className="stage-nav__cta" to={buildAuthModalHref(location)}>
                시작하기
              </NavLink>
            )}
          </div>
        </header>

        <main className="stage-main stage-main--landing">
          <Outlet />
        </main>

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
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--glass">
      <div className="app-shell__ambient" aria-hidden="true" />

      {!isImmersivePlayRoute ? (
        <header className="app-header-glass">
          <Link className="app-header-glass__brand" to="/">
            <strong>Mocha</strong>
          </Link>

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
                  onClick={() => void handleLogout()}
                  disabled={logoutBusy}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button className="stage-nav__cta" type="button" onClick={() => navigate(buildAuthModalHref(location))}>
                로그인
              </button>
            )}
          </div>
        </header>
      ) : null}

      <main className="app-main-glass">
        <Outlet />
      </main>

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
    </div>
  );
}

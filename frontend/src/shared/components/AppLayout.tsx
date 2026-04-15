import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const BASE_NAV_ITEMS = [
  { to: '/', label: 'Landing' },
  { to: '/challenges', label: 'Select' },
  { to: '/attempts', label: 'Archive' },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  const navItems = isAdmin ? [...BASE_NAV_ITEMS, { to: '/admin/model-assets', label: 'Admin' }] : BASE_NAV_ITEMS;
  const isLandingRoute = location.pathname === '/';

  if (isLandingRoute) {
    return (
      <div className="stage-shell stage-shell--landing">
        <header className="stage-topbar stage-topbar--landing">
          <Link className="stage-topbar__brand stage-topbar__brand--landing" to="/">
            <span className="stage-topbar__kicker stage-topbar__kicker--landing">Mocha</span>
            <div className="stage-topbar__title-row stage-topbar__title-row--landing">
              <h1>Mocha</h1>
            </div>
          </Link>

          <nav className="stage-nav stage-nav--landing" aria-label="랜딩 메뉴">
            <a href="#feature">Feature</a>
            <a href="#showcase">Showcase</a>
            <a href="#use-case">Use case</a>
            <a href="#footer">Footer</a>
            {isAdmin ? (
              <NavLink to="/admin/model-assets">
                Admin
              </NavLink>
            ) : null}
            {isAuthenticated ? (
              <NavLink className="stage-nav__cta" to="/challenges">
                Try now
              </NavLink>
            ) : (
              <button className="stage-nav__cta" type="button" onClick={() => navigate('/auth')}>
                Try now
              </button>
            )}
          </nav>
        </header>

        <main className="stage-main stage-main--landing">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="stage-shell">
      <div className="stage-shell__halo stage-shell__halo--cyan" aria-hidden="true" />
      <div className="stage-shell__halo stage-shell__halo--pink" aria-hidden="true" />
      <header className="stage-topbar">
        <div className="stage-topbar__brand">
          <span className="stage-topbar__kicker">MOCHA / MOTION SIGNAL</span>
          <div className="stage-topbar__title-row">
            <h1>Mocha Stage</h1>
            <span className="stage-topbar__status">Live Build</span>
          </div>
          <p>챌린지를 고르고 바로 촬영 흐름으로 진입하고, 결과까지 한 화면으로 이어지는 리듬 게임형 모션 스테이지입니다.</p>
        </div>
        <nav className="stage-nav" aria-label="주요 메뉴">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <button
              className="stage-nav__action"
              type="button"
              onClick={() => {
                void logout().then(() => navigate('/'));
              }}
            >
              {user?.displayName ?? 'Account'} / Logout
            </button>
          ) : (
            <button className="stage-nav__action" type="button" onClick={() => navigate('/auth')}>
              Login
            </button>
          )}
        </nav>
      </header>
      <main className="stage-main">
        <Outlet />
      </main>
    </div>
  );
}

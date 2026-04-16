import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';

const ADMIN_NAV_ITEMS = [
  { to: '/admin/model-assets', label: 'Admin Hub' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell app-shell--glass">
      <div className="app-shell__ambient" aria-hidden="true" />

      <header className="app-header-glass">
        <button className="app-header-glass__brand admin-header-brand" type="button" onClick={() => navigate('/admin/model-assets')}>
          <span className="app-header-glass__eyebrow">Admin Console</span>
          <strong>Mocha Admin</strong>
        </button>

        <nav className="app-header-glass__nav" aria-label="관리자 메뉴">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header-glass__actions">
          <span className="app-header-glass__account">{user?.displayName ?? 'Admin'}</span>
          <button className="stage-nav__utility" type="button" onClick={() => navigate('/')}>
            Public
          </button>
          <button
            className="stage-nav__utility"
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/'));
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="app-main-glass">
        <Outlet />
      </main>
    </div>
  );
}

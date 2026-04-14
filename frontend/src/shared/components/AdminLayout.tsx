import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const ADMIN_NAV_ITEMS = [
  { to: '/admin/model-assets', label: 'Hub' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <div className="admin-shell__glow admin-shell__glow--amber" aria-hidden="true" />
      <div className="admin-shell__glow admin-shell__glow--mint" aria-hidden="true" />
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__kicker">MOCHA / ADMIN CONSOLE</span>
          <h1>Admin Console</h1>
          <p>챌린지 운영, 모델 자산, 레퍼런스 분석 흐름을 인증 기반 관리자 셸에서 분리합니다.</p>
        </div>

        <nav className="admin-sidebar__nav" aria-label="관리자 메뉴">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          <button className="admin-sidebar__link" type="button" onClick={() => navigate('/')}>
            Public Stage
          </button>
        </nav>

        <div className="admin-sidebar__account">
          <span>관리 계정</span>
          <strong>{user?.displayName ?? 'Admin'}</strong>
          <p>{user?.email ?? '세션 정보 없음'}</p>
          <button
            className="admin-sidebar__logout"
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/'));
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';

const ADMIN_NAV_ITEMS = [
  { tab: 'challenges', label: '챌린지' },
  { tab: 'models', label: '모델' },
  { tab: 'members', label: '회원' },
  { tab: 'board', label: '게시판' },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [logoutBusy, setLogoutBusy] = useState(false);

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'models' || tab === 'members' || tab === 'board') {
      return tab;
    }
    return 'challenges';
  }, [location.search]);

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

  return (
    <div className="app-shell app-shell--glass">
      <div className="app-shell__ambient" aria-hidden="true" />

      <header className="app-header-glass">
        <button className="app-header-glass__brand admin-header-brand" type="button" onClick={() => navigate('/admin')}>
          <span className="app-header-glass__eyebrow">운영 콘솔</span>
          <strong>Mocha Admin</strong>
        </button>

        <nav className="app-header-glass__nav" aria-label="관리자 메뉴">
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.tab}
              className={activeTab === item.tab ? 'active' : undefined}
              to={`/admin?tab=${item.tab}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-header-glass__actions">
          <span className="app-header-glass__account">{user?.displayName ?? '관리자'}</span>
          <button className="stage-nav__utility" type="button" onClick={() => navigate('/')}>
            공개 화면
          </button>
          <button
            className="stage-nav__utility"
            type="button"
            onClick={() => void handleLogout()}
            disabled={logoutBusy}
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

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { CompactConfirmDialog } from './CompactConfirmDialog';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: '허브 홈' },
  { to: '/admin/model-assets', label: '운영 관리' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function handleConfirmLogout() {
    setLogoutBusy(true);

    try {
      await logout();
      navigate('/');
    } finally {
      setLogoutBusy(false);
      setLogoutConfirmOpen(false);
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
            <NavLink key={item.to} to={item.to} end={item.to === '/admin'}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header-glass__actions">
          <span className="app-header-glass__account">{user?.displayName ?? '관리자'}</span>
          <button className="stage-nav__utility" type="button" onClick={() => navigate('/')}>
            공개 화면
          </button>
          <button className="stage-nav__utility" type="button" onClick={() => setLogoutConfirmOpen(true)}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="app-main-glass">
        <Outlet />
      </main>

      <CompactConfirmDialog
        open={logoutConfirmOpen}
        title="로그아웃"
        description="관리자 세션을 종료하고 홈 화면으로 이동합니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        busy={logoutBusy}
        onConfirm={handleConfirmLogout}
        onCancel={() => {
          if (!logoutBusy) {
            setLogoutConfirmOpen(false);
          }
        }}
      />
    </div>
  );
}

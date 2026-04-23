import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { CompactConfirmDialog } from './CompactConfirmDialog';
import { CompactToast } from './CompactToast';

const ADMIN_NAV_ITEMS = [
  { tab: 'challenges', label: '챌린지' },
  { tab: 'models', label: '모델' },
  { tab: 'members', label: '회원' },
  { tab: 'board', label: '게시판' },
];

type LayoutToast = {
  message: string;
  type: 'success' | 'error';
};

type LayoutLocationState = {
  compactToast?: LayoutToast;
} | null;

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [layoutToast, setLayoutToast] = useState<LayoutToast | null>(null);

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'models' || tab === 'members' || tab === 'board') {
      return tab;
    }
    return 'challenges';
  }, [location.search]);

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
      navigate('/', {
        replace: true,
        state: {
          compactToast: {
            message: '로그아웃 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
            type: 'error',
          },
        },
      });
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
            onClick={() => setLogoutConfirmOpen(true)}
            disabled={logoutBusy}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="app-main-glass">
        <Outlet />
      </main>

      <CompactConfirmDialog
        open={logoutConfirmOpen}
        title="로그아웃할까요?"
        description="관리자 계정에서 로그아웃하고 홈 화면으로 이동합니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        tone="danger"
        busy={logoutBusy}
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
      <CompactToast
        message={layoutToast?.message ?? null}
        type={layoutToast?.type ?? 'success'}
        onClose={() => setLayoutToast(null)}
      />
    </div>
  );
}

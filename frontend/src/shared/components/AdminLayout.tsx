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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'models' || tab === 'members' || tab === 'board') {
      return tab;
    }
    return 'challenges';
  }, [location.search]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

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

  const mobileMenuOverlay = (
    <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'is-open' : ''}`}>
      <div className="mobile-menu-overlay__backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      <div className="mobile-menu-overlay__panel">
        <div className="mobile-menu-overlay__header">
          <strong>Mocha Admin</strong>
          <button type="button" onClick={() => setIsMobileMenuOpen(false)} aria-label="메뉴 닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <nav className="mobile-menu-overlay__nav">
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.tab}
              className={activeTab === item.tab ? 'active' : undefined}
              to={`/admin?tab=${item.tab}`}
            >
              {item.label}
            </Link>
          ))}
          <Link to="/">공개 화면으로</Link>
        </nav>
        <div className="mobile-menu-overlay__actions">
          <span className="mobile-menu-overlay__account">{user?.displayName ?? '관리자'}</span>
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
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell app-shell--glass">
      <div className="app-shell__ambient" aria-hidden="true" />

      <header className="app-header-glass">
        <button className="app-header-glass__brand admin-header-brand" type="button" onClick={() => navigate('/admin')}>
          <span className="app-header-glass__eyebrow">운영 콘솔</span>
          <strong>Mocha Admin</strong>
        </button>

        <button
          className="mobile-menu-trigger"
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="메뉴 열기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
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
      {mobileMenuOverlay}
    </div>
  );
}

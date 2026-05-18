import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { buildAuthModalHref, buildPathWithSearch, resolveAuthMode } from './authModalUtils';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="panel panel--section">로그인 상태를 확인하는 중입니다.</div>;
  }

  if (!isAuthenticated) {
    const authMode = resolveAuthMode(new URLSearchParams(location.search).get('auth'));
    if (authMode) {
      return null;
    }

    return (
      <Navigate
        to={buildAuthModalHref(location, {
          redirectPath: buildPathWithSearch(location.pathname, location.search),
        })}
        replace
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

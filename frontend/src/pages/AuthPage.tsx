import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AuthModal } from '../shared/auth/AuthModal';
import { buildPathWithSearch, resolveAuthFeedback, resolveAuthMode, sanitizeAuthRedirectPath, type AuthMode } from '../shared/auth/authModalUtils';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode = resolveAuthMode(params.get('mode')) ?? 'login';
  const redirectTarget = sanitizeAuthRedirectPath(params.get('redirect'));
  const authFeedback = resolveAuthFeedback(params);

  function handleClose() {
    const fallback = redirectTarget && !redirectTarget.startsWith('/admin') ? redirectTarget : '/';
    navigate(fallback, { replace: true });
  }

  return (
    <AuthModal
      standalone
      mode={mode}
      redirectTarget={redirectTarget}
      feedback={authFeedback}
      onClose={handleClose}
      onModeChange={(nextMode: AuthMode) => {
        const nextPath = buildPathWithSearch(location.pathname, location.search);
        const nextQuery = new URLSearchParams();
        nextQuery.set('mode', nextMode);
        if (redirectTarget) {
          nextQuery.set('redirect', redirectTarget);
        }
        navigate(`${nextPath}?${nextQuery.toString()}`, { replace: true });
      }}
    />
  );
}

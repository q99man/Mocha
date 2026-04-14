import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthProvider';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, isAuthenticated, isAdmin, user } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requestedRedirect = params.get('redirect');
    if (requestedRedirect?.startsWith('/admin') && !isAdmin) {
      return '/';
    }
    return requestedRedirect ?? (isAdmin ? '/admin/model-assets' : '/');
  }, [isAdmin, location.search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const normalizedDisplayName = displayName.trim();

    if (mode === 'register' && normalizedDisplayName.length === 0) {
      setError('표시 이름을 입력해 주세요.');
      setSubmitting(false);
      return;
    }

    try {
      const session =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName: normalizedDisplayName });

      const nextTarget = redirectTarget.startsWith('/admin') && session.role !== 'ADMIN'
        ? '/'
        : redirectTarget;
      navigate(nextTarget, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '인증 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoading && isAuthenticated) {
    return (
      <section className="auth-panel panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">AUTH</span>
          <div>
            <h2>이미 로그인되어 있습니다</h2>
            <p>{user?.displayName} 계정으로 접속 중입니다.</p>
          </div>
        </div>
        <div className="inline-actions">
          <button className="button-link" type="button" onClick={() => navigate(redirectTarget)}>
            계속 이동
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <article className="auth-panel panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">AUTH</span>
          <div>
            <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>
            <p>세션 로그인 기반으로 관리자 화면 접근을 제어합니다. 첫 가입 계정은 관리자 권한을 받습니다.</p>
          </div>
        </div>

        <div className="archive-filter-group">
          {(['login', 'register'] as AuthMode[]).map((candidate) => (
            <button
              key={candidate}
              className={`archive-filter ${mode === candidate ? 'archive-filter--active' : ''}`}
              type="button"
              onClick={() => {
                setMode(candidate);
                setError(null);
              }}
            >
              <span>{candidate === 'login' ? '로그인' : '회원가입'}</span>
            </button>
          ))}
        </div>

        <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
          {mode === 'register' ? (
            <label className="admin-form__field">
              <span>이름</span>
              <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="표시 이름" />
            </label>
          ) : null}
          <label className="admin-form__field">
            <span>이메일</span>
            <input type="text" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="admin-form__field">
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" />
          </label>
          <div className="inline-actions">
            <button className="button-link" type="submit" disabled={submitting}>
              {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </div>
        </form>

        {error ? <p className="admin-form__message admin-form__message--error">{error}</p> : null}
      </article>
    </section>
  );
}

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
    return requestedRedirect ?? (isAdmin ? '/admin/model-assets' : '/mypage');
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

      const nextTarget = redirectTarget.startsWith('/admin') && session.role !== 'ADMIN' ? '/' : redirectTarget;
      navigate(nextTarget, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '인증 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-page glass-page--auth">
      <section className="glass-auth-card">
        <div className="glass-intro glass-intro--compact">
          <div>
            <span className="glass-intro__eyebrow"></span>
            <h2>{isAuthenticated ? '이미 로그인된 상태입니다' : mode === 'login' ? '로그인' : '회원가입'}</h2>
            <p>
              {isAuthenticated
                ? `${user?.displayName ?? '회원'}님, 접속 중입니다.`
                : '정보를 입력해 주세요.'}
            </p>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="glass-auth-card__footer">
            <button className="button-link" type="button" onClick={() => navigate(redirectTarget)}>
              계속 이동
            </button>
          </div>
        ) : (
          <>
            <div className="glass-chip-group">
              {(['login', 'register'] as AuthMode[]).map((candidate) => (
                <button
                  key={candidate}
                  className={`glass-chip${mode === candidate ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => {
                    setMode(candidate);
                    setError(null);
                  }}
                >
                  {candidate === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            <form className="glass-form" onSubmit={(event) => void handleSubmit(event)}>
              {mode === 'register' ? (
                <label className="glass-field">
                  <span>표시 이름</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="사용할 이름"
                  />
                </label>
              ) : null}

              <label className="glass-field">
                <span>이메일</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label className="glass-field">
                <span>비밀번호</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호"
                />
              </label>

              {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}

              <div className="glass-auth-card__footer">
                <button className="button-link" type="submit" disabled={submitting || isLoading}>
                  {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

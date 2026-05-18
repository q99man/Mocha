import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { buildSocialLoginUrl } from '../api/authApi';
import type { SocialAuthProvider } from '../types/auth';
import { useAuth } from './AuthProvider';
import { type AuthFeedback, type AuthMode } from './authModalUtils';

const SOCIAL_LOGIN_OPTIONS: Array<{
  provider: SocialAuthProvider;
  label: string;
  icon: JSX.Element;
}> = [
  {
    provider: 'NAVER',
    label: '네이버로 계속하기',
    icon: (
      <svg viewBox="0 0 24 24" fill="white">
        <path 
          transform="translate(3, 3) scale(0.75)"
          d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" 
        />
      </svg>
    ),
  },
  {
    provider: 'KAKAO',
    label: '카카오로 계속하기',
    icon: (
      <svg viewBox="0 0 24 24" fill="black">
        <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.707 4.8 4.34 6.054-.188.702-.68 2.531-.777 2.94-.123.502.19.495.396.355.16-.11 2.523-1.713 3.535-2.403.487.054.987.082 1.506.082 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
        <text x="12" y="12.5" fontSize="5" fontWeight="bold" textAnchor="middle" fill="black">TALK</text>
      </svg>
    ),
  },
  {
    provider: 'GOOGLE',
    label: '구글로 계속하기',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
      </svg>
    ),
  },
];

type AuthModalProps = {
  mode: AuthMode;
  redirectTarget?: string | null;
  feedback?: AuthFeedback | null;
  standalone?: boolean;
  onClose?: () => void;
  onModeChange?: (mode: AuthMode) => void;
};

export function AuthModal({
  mode,
  redirectTarget,
  feedback = null,
  standalone = false,
  onClose,
  onModeChange,
}: AuthModalProps) {
  const navigate = useNavigate();
  const { login, register, isLoading, isAuthenticated, isAdmin } = useAuth();
  const [activeMode, setActiveMode] = useState<AuthMode>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleFeedback, setVisibleFeedback] = useState<AuthFeedback | null>(feedback);
  const [socialPreviewProvider, setSocialPreviewProvider] = useState<SocialAuthProvider>(feedback?.provider ?? 'KAKAO');
  const modalPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveMode(mode);
    setPassword('');
    setError(null);
  }, [mode]);

  useEffect(() => {
    setVisibleFeedback(feedback);
    if (feedback?.provider) {
      setSocialPreviewProvider(feedback.provider);
    }
  }, [feedback]);

  useEffect(() => {
    if (standalone) {
      return;
    }

    document.body.classList.add('body--modal-open');
    return () => {
      document.body.classList.remove('body--modal-open');
    };
  }, [standalone]);

  useEffect(() => {
    const handleClose: (() => void) | null = onClose ?? null;

    if (standalone || handleClose === null) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose?.();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, standalone]);

  useEffect(() => {
    if (standalone) {
      return;
    }

    const panel = modalPanelRef.current;
    if (!panel) {
      return;
    }
    const modalPanel = panel;

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const getFocusableElements = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        const isHidden = element.hasAttribute('aria-hidden') || element.offsetParent === null;
        return !isHidden;
      });

    const focusTimer = window.setTimeout(() => {
      (getFocusableElements()[0] ?? modalPanel).focus();
    }, 0);

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        modalPanel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleTabKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleTabKey);
      previouslyFocusedElement?.focus();
    };
  }, [standalone]);

  useEffect(() => {
    if (!visibleFeedback?.autoClose || !isAuthenticated || !onClose) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isAuthenticated, onClose, visibleFeedback]);

  const resolvedRedirectTarget = useMemo(() => {
    if (redirectTarget?.startsWith('/admin') && !isAdmin) {
      return '/';
    }
    return redirectTarget ?? (isAdmin ? '/admin' : '/mypage');
  }, [isAdmin, redirectTarget]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setVisibleFeedback(null);

    const normalizedDisplayName = displayName.trim();

    if (activeMode === 'register' && normalizedDisplayName.length === 0) {
      setError('표시 이름을 입력해 주세요.');
      setSubmitting(false);
      return;
    }

    try {
      const session =
        activeMode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName: normalizedDisplayName });

      const requestedTarget = redirectTarget ?? (session.role === 'ADMIN' ? '/admin' : '/mypage');
      const nextTarget = requestedTarget.startsWith('/admin') && session.role !== 'ADMIN' ? '/' : requestedTarget;
      navigate(nextTarget, {
        replace: true,
        state: {
          compactToast: {
            message: activeMode === 'login' ? '로그인되었습니다.' : '회원가입이 완료되었습니다.',
            type: 'success',
          },
        },
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '인증 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocialLogin(provider: SocialAuthProvider) {
    setError(null);
    setVisibleFeedback(null);
    setSocialPreviewProvider(provider);
    window.location.href = buildSocialLoginUrl(provider, resolvedRedirectTarget);
  }

  function handleModeChange(nextMode: AuthMode) {
    setActiveMode(nextMode);
    setError(null);
    setPassword('');
    onModeChange?.(nextMode);
  }

  const card = (
    <section className={`glass-auth-card${standalone ? ' glass-auth-card--standalone' : ''}`}>
      <div className="glass-auth-header">
        <h2>{activeMode === 'login' ? '로그인' : '회원가입'}</h2>
        {onClose ? (
          <button className="glass-auth-card__close-top" type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        ) : null}
      </div>

      {visibleFeedback ? (
        <div
          className={`glass-auth-toast glass-auth-toast--${visibleFeedback.tone}`}
          role={visibleFeedback.tone === 'error' ? 'alert' : 'status'}
        >
          <div className="glass-auth-toast__body">
            <strong>{visibleFeedback.title}</strong>
            <p>{visibleFeedback.description}</p>
            {visibleFeedback.autoClose && isAuthenticated ? (
              <span className="glass-auth-toast__meta">잠시 후 자동으로 닫히고 원래 화면으로 이어집니다.</span>
            ) : null}
          </div>
          <button
            className="glass-auth-toast__close"
            type="button"
            aria-label="안내 닫기"
            onClick={() => setVisibleFeedback(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {isAuthenticated ? (
        <div className="glass-auth-card__surface">
          <p className="glass-auth-card__hint">계속 이동을 누르면 요청했던 화면으로 바로 돌아갑니다.</p>
          <div className="glass-auth-card__footer">
            <button className="button-link" type="button" onClick={() => onClose?.()}>
              계속 이동
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-auth-card__surface">
          {error ? <p className="glass-auth-card__message glass-auth-card__message--error">{error}</p> : null}

          <div className="glass-segmented-control">
            {(['login', 'register'] as AuthMode[]).map((candidate) => (
              <button
                key={candidate}
                className={`glass-segmented-btn${activeMode === candidate ? ' is-active' : ''}`}
                type="button"
                onClick={() => handleModeChange(candidate)}
              >
                {candidate === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <form className="glass-form" onSubmit={(event) => void handleSubmit(event)}>
            {activeMode === 'register' ? (
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

            <div className="glass-auth-card__footer">
              <button className="button-link" type="submit" disabled={submitting || isLoading}>
                {submitting ? '처리 중...' : activeMode === 'login' ? '로그인' : '회원가입'}
              </button>
            </div>
          </form>

          <div className="glass-auth-divider" aria-hidden="true">
            <span>소셜 로그인</span>
          </div>

          <div className="glass-auth-social-row">
            {SOCIAL_LOGIN_OPTIONS.map((option) => (
              <button
                key={option.provider}
                className={`glass-auth-social-circle glass-auth-social-circle--${option.provider.toLowerCase()}${
                  socialPreviewProvider === option.provider ? ' is-active' : ''
                }`}
                type="button"
                onClick={() => handleSocialLogin(option.provider)}
                onMouseEnter={() => setSocialPreviewProvider(option.provider)}
                onFocus={() => setSocialPreviewProvider(option.provider)}
                aria-label={option.label}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  if (standalone) {
    return (
      <div className="glass-page glass-page--auth">
        <div className="glass-modal glass-modal--inline">
          <div className="glass-modal__backdrop" aria-hidden="true" />
          <div className="glass-modal__panel" role="dialog" aria-modal="true" aria-label="인증">
            {card}
          </div>
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="glass-modal" role="presentation">
      <button className="glass-modal__backdrop" type="button" aria-label="인증 모달 닫기" onClick={onClose} />
      <div
        ref={modalPanelRef}
        className="glass-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="인증"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {card}
      </div>
    </div>,
    document.body,
  );
}

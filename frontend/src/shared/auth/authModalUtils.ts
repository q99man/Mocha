import type { SocialAuthProvider } from '../types/auth';

export type AuthMode = 'login' | 'register';
export type AuthFeedbackTone = 'success' | 'info' | 'error';
export type AuthFeedbackStatus = 'login' | 'linked' | 'signup' | 'failure';

export type AuthFeedback = {
  status: AuthFeedbackStatus;
  provider: SocialAuthProvider | null;
  tone: AuthFeedbackTone;
  title: string;
  description: string;
  autoClose: boolean;
};

type LocationLike = {
  pathname: string;
  search: string;
};

type BuildAuthModalHrefOptions = {
  mode?: AuthMode;
  redirectPath?: string | null;
  error?: string | null;
};

export function resolveAuthMode(value: string | null): AuthMode | null {
  if (value === 'register') {
    return 'register';
  }
  if (value === 'login') {
    return 'login';
  }
  return null;
}

export function sanitizeAuthRedirectPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//') || normalized.startsWith('/\\')) {
    return null;
  }

  return normalized;
}

export function stripAuthModalSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('auth');
  params.delete('redirect');
  params.delete('error');
  params.delete('social');
  params.delete('provider');
  params.delete('reason');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildPathWithSearch(pathname: string, search: string): string {
  return `${pathname}${stripAuthModalSearch(search)}`;
}

export function buildAuthModalHref(
  location: LocationLike,
  { mode = 'login', redirectPath, error }: BuildAuthModalHrefOptions = {},
): string {
  const params = new URLSearchParams(stripAuthModalSearch(location.search));
  params.set('auth', mode);

  const safeRedirect = sanitizeAuthRedirectPath(redirectPath);
  if (safeRedirect) {
    params.set('redirect', safeRedirect);
  }

  if (error) {
    params.set('error', error);
  }

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}`;
}

export function resolveSocialAuthProvider(value: string | null): SocialAuthProvider | null {
  if (value === 'KAKAO' || value === 'NAVER' || value === 'GOOGLE') {
    return value;
  }

  if (value === 'kakao') {
    return 'KAKAO';
  }
  if (value === 'naver') {
    return 'NAVER';
  }
  if (value === 'google') {
    return 'GOOGLE';
  }

  return null;
}

export function formatSocialAuthProvider(provider: SocialAuthProvider | null): string {
  switch (provider) {
    case 'KAKAO':
      return '카카오';
    case 'NAVER':
      return '네이버';
    case 'GOOGLE':
      return '구글';
    default:
      return '소셜';
  }
}

export function resolveAuthFeedback(params: URLSearchParams): AuthFeedback | null {
  const provider = resolveSocialAuthProvider(params.get('provider'));
  const providerLabel = formatSocialAuthProvider(provider);
  const social = params.get('social');
  const reason = params.get('reason');

  switch (social) {
    case 'signup':
      return {
        status: 'signup',
        provider,
        tone: 'success',
        title: `${providerLabel} 계정으로 가입되었습니다`,
        description: '초기 계정 생성과 로그인이 완료되었습니다. 잠시 후 원래 보던 화면으로 이어집니다.',
        autoClose: true,
      };
    case 'linked':
      return {
        status: 'linked',
        provider,
        tone: 'success',
        title: `${providerLabel} 계정이 기존 회원 정보에 연결되었습니다`,
        description: '같은 이메일 계정을 찾아 연결했습니다. 다음부터는 이 소셜 로그인으로 바로 들어올 수 있습니다.',
        autoClose: true,
      };
    case 'login':
      return {
        status: 'login',
        provider,
        tone: 'info',
        title: `${providerLabel} 로그인 확인 완료`,
        description: '인증이 끝났습니다. 잠시 후 요청한 화면으로 이어집니다.',
        autoClose: true,
      };
    case 'failure':
      return {
        status: 'failure',
        provider,
        tone: 'error',
        title: reason === 'cancelled' ? `${providerLabel} 로그인 연결이 취소되었습니다` : `${providerLabel} 로그인에 실패했습니다`,
        description:
          reason === 'cancelled'
            ? '인증 창에서 연결이 중단되었습니다. 같은 버튼으로 다시 시도하거나 이메일 로그인으로 진행할 수 있습니다.'
            : '인증 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        autoClose: false,
      };
    default:
      break;
  }

  if (params.get('error') === 'social') {
    return {
      status: 'failure',
      provider,
      tone: 'error',
      title: `${providerLabel} 로그인에 실패했습니다`,
      description: '인증 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      autoClose: false,
    };
  }

  return null;
}

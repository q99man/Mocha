import { API_BASE_URL, postJson, resolveApiUrl } from './client';
import type { AuthSession, LoginInput, RegisterInput, SocialAuthProvider } from '../types/auth';

export async function register(input: RegisterInput): Promise<AuthSession> {
  return postJson<AuthSession, RegisterInput>('/api/auth/register', input);
}

export async function login(input: LoginInput): Promise<AuthSession> {
  return postJson<AuthSession, LoginInput>('/api/auth/login', input);
}

export async function logout(): Promise<void> {
  await postJson<{ success: boolean }, Record<string, never>>('/api/auth/logout', {});
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('로그인 상태를 확인하지 못했습니다.');
  }

  return response.json() as Promise<AuthSession>;
}

export function buildSocialLoginUrl(provider: SocialAuthProvider, redirectPath?: string): string {
  const registrationId = provider.toLowerCase();
  const query = new URLSearchParams();
  if (redirectPath) {
    query.set('redirect', redirectPath);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return resolveApiUrl(`/oauth2/authorization/${registrationId}${suffix}`);
}

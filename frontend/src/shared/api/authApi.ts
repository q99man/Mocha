import { API_BASE_URL, postJson } from './client';
import type { AuthSession, LoginInput, RegisterInput } from '../types/auth';

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

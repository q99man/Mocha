import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentSession, login as loginRequest, logout as logoutRequest, register as registerRequest } from '../api/authApi';
import type { AuthSession, LoginInput, RegisterInput } from '../types/auth';

type AuthContextValue = {
  user: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const current = await getCurrentSession();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(input: LoginInput) {
    const session = await loginRequest(input);
    setUser(session);
    return session;
  }

  async function register(input: RegisterInput) {
    const session = await registerRequest(input);
    setUser(session);
    return session;
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'ADMIN',
    login,
    register,
    logout,
    refresh,
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

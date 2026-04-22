import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../../pages/AuthPage';
import { RequireAdmin } from '../RequireAdmin';
import { RequireAuth } from '../RequireAuth';
import { useAuth } from '../AuthProvider';

vi.mock('../AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to auth with redirect preserved', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/mypage']}>
        <Routes>
          <Route
            path="/mypage"
            element={(
              <RequireAuth>
                <div>Protected mypage</div>
              </RequireAuth>
            )}
          />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  });

  it('redirects authenticated non-admin users away from admin routes', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'user@example.com',
        displayName: 'Normal User',
        authProvider: 'LOCAL',
        role: 'USER',
        authenticated: true,
      },
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/model-assets']}>
        <Routes>
          <Route path="/" element={<div>Public Home</div>} />
          <Route
            path="/admin/model-assets"
            element={(
              <RequireAdmin>
                <div>Admin Console</div>
              </RequireAdmin>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Public Home')).toBeInTheDocument();
    expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();
  });
});

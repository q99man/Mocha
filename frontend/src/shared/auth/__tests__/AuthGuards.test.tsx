import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAdmin } from '../RequireAdmin';
import { RequireAuth } from '../RequireAuth';
import { useAuth } from '../AuthProvider';

vi.mock('../AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}`}</output>;
}

describe('auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the auth modal query on the current page with redirect preserved', async () => {
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
      <MemoryRouter initialEntries={['/mypage?tab=attempts']}>
        <LocationProbe />
        <Routes>
          <Route
            path="/mypage"
            element={(
              <RequireAuth>
                <div>Protected mypage</div>
              </RequireAuth>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('location')).toHaveTextContent('/mypage?tab=attempts&auth=login');
    expect(screen.getByLabelText('location')).toHaveTextContent('redirect=%2Fmypage%3Ftab%3Dattempts');
    expect(screen.queryByText('Protected mypage')).not.toBeInTheDocument();
  });

  it('opens the auth modal query for unauthenticated admin routes', async () => {
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
      <MemoryRouter initialEntries={['/admin?tab=challenges']}>
        <LocationProbe />
        <Routes>
          <Route
            path="/admin"
            element={(
              <RequireAdmin>
                <div>Admin Console</div>
              </RequireAdmin>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('location')).toHaveTextContent('/admin?tab=challenges&auth=login');
    expect(screen.getByLabelText('location')).toHaveTextContent('redirect=%2Fadmin%3Ftab%3Dchallenges');
    expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();
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

import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../shared/components/AdminLayout';
import { AppLayout } from '../shared/components/AppLayout';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { RequireAdmin } from '../shared/auth/RequireAdmin';
import { AdminChallengeAnalysisPage } from '../pages/AdminChallengeAnalysisPage';
import { AdminModelAssetsPage } from '../pages/AdminModelAssetsPage';
import { AttemptResultPage } from '../pages/AttemptResultPage';
import { AttemptsPage } from '../pages/AttemptsPage';
import { AuthPage } from '../pages/AuthPage';
import { ChallengeDetailPage } from '../pages/ChallengeDetailPage';
import { ChallengeStartPage } from '../pages/ChallengeStartPage';
import { ChallengesPage } from '../pages/ChallengesPage';
import { HomePage } from '../pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'auth',
        element: <AuthPage />,
      },
      {
        path: 'challenges',
        element: <ChallengesPage />,
      },
      {
        path: 'challenges/:id',
        element: <ChallengeDetailPage />,
      },
      {
        path: 'challenges/:id/start',
        element: (
          <RequireAuth>
            <ChallengeStartPage />
          </RequireAuth>
        ),
      },
      {
        path: 'attempts',
        element: (
          <RequireAuth>
            <AttemptsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'attempts/:id/result',
        element: (
          <RequireAuth>
            <AttemptResultPage />
          </RequireAuth>
        ),
      },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      {
        path: 'model-assets',
        element: <AdminModelAssetsPage />,
      },
      {
        path: 'challenges/:id/analysis',
        element: <AdminChallengeAnalysisPage />,
      },
    ],
  },
]);

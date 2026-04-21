import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../shared/components/AdminLayout';
import { AppLayout } from '../shared/components/AppLayout';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { RequireAdmin } from '../shared/auth/RequireAdmin';
import { AdminChallengeAnalysisPage } from '../pages/AdminChallengeAnalysisPage';
import { AdminHubPage } from '../pages/AdminHubPage';
import { AdminModelAssetsPage } from '../pages/AdminModelAssetsPage';
import { AttemptResultPage } from '../pages/AttemptResultPage';
import { AuthPage } from '../pages/AuthPage';
import { BoardDetailPage } from '../pages/BoardDetailPage';
import { BoardEditorPage } from '../pages/BoardEditorPage';
import { BoardPage } from '../pages/BoardPage';
import { ChallengeStartPage } from '../pages/ChallengeStartPage';
import { ChallengesPage } from '../pages/ChallengesPage';
import { HomePage } from '../pages/HomePage';
import { MyPage } from '../pages/MyPage';

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
        path: 'board',
        element: <BoardPage />,
      },
      {
        path: 'board/:id',
        element: <BoardDetailPage />,
      },
      {
        path: 'board/new',
        element: (
          <RequireAuth>
            <BoardEditorPage />
          </RequireAuth>
        ),
      },
      {
        path: 'board/:id/edit',
        element: (
          <RequireAuth>
            <BoardEditorPage />
          </RequireAuth>
        ),
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
        path: 'mypage',
        element: (
          <RequireAuth>
            <MyPage />
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
        index: true,
        element: <AdminHubPage />,
      },
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

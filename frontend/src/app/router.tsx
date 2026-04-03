import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../shared/components/AppLayout';
import { AttemptsPage } from '../pages/AttemptsPage';
import { AttemptResultPage } from '../pages/AttemptResultPage';
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
        path: 'challenges',
        element: <ChallengesPage />,
      },
      {
        path: 'challenges/:id',
        element: <ChallengeDetailPage />,
      },
      {
        path: 'challenges/:id/start',
        element: <ChallengeStartPage />,
      },
      {
        path: 'attempts',
        element: <AttemptsPage />,
      },
      {
        path: 'attempts/:id/result',
        element: <AttemptResultPage />,
      },
    ],
  },
]);
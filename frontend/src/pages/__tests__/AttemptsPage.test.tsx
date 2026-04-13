import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAttempts, getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { buildAttemptProgress, buildAttemptSummary } from '../../test/fixtures/attemptFixtures';
import { AttemptsPage } from '../AttemptsPage';

vi.mock('../../shared/api/attemptApi', () => ({
  getAttempts: vi.fn(),
  getAttemptVideoProcessingProgressByTrackingId: vi.fn(),
}));

const mockedGetAttempts = vi.mocked(getAttempts);
const mockedGetAttemptVideoProcessingProgressByTrackingId = vi.mocked(getAttemptVideoProcessingProgressByTrackingId);

describe('AttemptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('silently refreshes the archive after durable progress resolves to a completed result', async () => {
    const pendingAttempt = buildAttemptSummary({
      id: 30,
      challengeId: 77,
      challengeTitle: 'Spin Routine',
      resultHeadline: 'Pending archive result',
      resultSummary: 'Pending archive summary.',
      pendingTrackingId: 'tracking-30',
    });
    const completedAttempt = buildAttemptSummary({
      id: 31,
      challengeId: 77,
      challengeTitle: 'Spin Routine',
      score: 91,
      status: 'Completed',
      resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
      scoreAvailable: true,
      resultHeadline: 'Completed archive result',
      resultSummary: 'Completed archive summary.',
      processingMode: 'SYNC_INLINE',
      processingComplete: true,
      processingNotice: null,
      pendingTrackingId: null,
      durableProgressStatus: 'COMPLETED',
      completionStrategy: 'INLINE_FLOW',
      poseSimilarity: 92,
      timingSimilarity: 90,
      stabilitySimilarity: 89,
      strongestArea: 'pose shape',
      weakestArea: 'detection quality',
    });

    mockedGetAttempts.mockResolvedValueOnce([pendingAttempt]).mockResolvedValueOnce([completedAttempt]);
    mockedGetAttemptVideoProcessingProgressByTrackingId.mockResolvedValue(
      buildAttemptProgress({
        trackingId: 'tracking-30',
        challengeId: 77,
        status: 'COMPLETED',
        resultAttemptId: 31,
        completionStrategy: 'AUTO_RUNNER',
        processingNotice: 'Result ready.',
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts']}>
        <Routes>
          <Route path="/attempts" element={<AttemptsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Pending archive summary.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh durable progress' }));

    await waitFor(() => expect(mockedGetAttempts).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Completed archive summary.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh durable progress' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open result' })).toHaveAttribute('href', '/attempts/31/result');
  });
});

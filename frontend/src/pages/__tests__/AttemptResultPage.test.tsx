import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { buildAttemptProgress, buildAttemptSummary } from '../../test/fixtures/attemptFixtures';
import { AttemptResultPage } from '../AttemptResultPage';

vi.mock('../../shared/api/attemptApi', () => ({
  getAttemptById: vi.fn(),
  getAttemptVideoProcessingProgressByTrackingId: vi.fn(),
}));

const mockedGetAttemptById = vi.mocked(getAttemptById);
const mockedGetAttemptVideoProcessingProgressByTrackingId = vi.mocked(getAttemptVideoProcessingProgressByTrackingId);

describe('AttemptResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the completed result when durable progress resolves to a new attempt id', async () => {
    const pendingAttempt = buildAttemptSummary({
      id: 10,
      challengeId: 42,
      challengeTitle: 'Wave Combo',
      resultHeadline: 'Pending result',
      resultSummary: 'Waiting for the finished score.',
      pendingTrackingId: 'tracking-10',
    });
    const completedAttempt = buildAttemptSummary({
      id: 11,
      challengeId: 42,
      challengeTitle: 'Wave Combo',
      score: 87,
      status: 'Completed',
      resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
      scoreAvailable: true,
      resultHeadline: 'Completed result',
      resultSummary: 'Completed refreshed summary.',
      processingMode: 'SYNC_INLINE',
      processingComplete: true,
      processingNotice: null,
      pendingTrackingId: null,
      durableProgressStatus: 'COMPLETED',
      completionStrategy: 'INLINE_FLOW',
      poseSimilarity: 88,
      timingSimilarity: 84,
      stabilitySimilarity: 81,
      strongestArea: 'pose similarity',
      weakestArea: 'timing',
    });

    mockedGetAttemptById.mockImplementation(async (id) =>
      Number(id) === 10 ? pendingAttempt : completedAttempt,
    );
    mockedGetAttemptVideoProcessingProgressByTrackingId.mockResolvedValue(
      buildAttemptProgress({
        trackingId: 'tracking-10',
        challengeId: 42,
        status: 'COMPLETED',
        resultAttemptId: 11,
        completionStrategy: 'AUTO_RUNNER',
        processingNotice: 'Result ready.',
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts/10/result']}>
        <Routes>
          <Route path="/attempts/:id/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Pending result' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh processing status' }));

    expect(await screen.findByRole('heading', { name: 'Completed result' })).toBeInTheDocument();
    expect(screen.getByText('Completed refreshed summary.')).toBeInTheDocument();
    expect(mockedGetAttemptById).toHaveBeenCalledWith(10);
    expect(mockedGetAttemptById).toHaveBeenCalledWith(11);
  });

  it('refreshes the current result when durable progress completes on the same attempt id', async () => {
    const pendingAttempt = buildAttemptSummary({
      id: 20,
      challengeId: 55,
      challengeTitle: 'Kick Pattern',
      resultHeadline: 'Kick result pending',
      resultSummary: 'Still waiting for analysis.',
      pendingTrackingId: 'tracking-20',
    });
    const refreshedAttempt = buildAttemptSummary({
      id: 20,
      challengeId: 55,
      challengeTitle: 'Kick Pattern',
      score: 74,
      status: 'Completed',
      resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
      scoreAvailable: true,
      resultHeadline: 'Kick result ready',
      resultSummary: 'Refreshed same-result summary.',
      processingMode: 'SYNC_INLINE',
      processingComplete: true,
      processingNotice: null,
      pendingTrackingId: null,
      durableProgressStatus: 'COMPLETED',
      completionStrategy: 'INLINE_FLOW',
      poseSimilarity: 70,
      timingSimilarity: 76,
      stabilitySimilarity: 78,
      strongestArea: 'detection stability',
      weakestArea: 'pose similarity',
    });

    mockedGetAttemptById.mockResolvedValueOnce(pendingAttempt).mockResolvedValueOnce(refreshedAttempt);
    mockedGetAttemptVideoProcessingProgressByTrackingId.mockResolvedValue(
      buildAttemptProgress({
        trackingId: 'tracking-20',
        challengeId: 55,
        status: 'COMPLETED',
        resultAttemptId: 20,
        completionStrategy: 'AUTO_RUNNER',
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts/20/result']}>
        <Routes>
          <Route path="/attempts/:id/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Kick result pending' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh processing status' }));

    expect(await screen.findByRole('heading', { name: 'Kick result ready' })).toBeInTheDocument();
    expect(screen.getByText('Refreshed same-result summary.')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetAttemptById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Refresh processing status' })).not.toBeInTheDocument();
  });
});

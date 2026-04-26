import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { getChallengeById } from '../../shared/api/challengeApi';
import { buildAttemptProgress, buildAttemptSummary } from '../../test/fixtures/attemptFixtures';
import { AttemptResultPage } from '../AttemptResultPage';

vi.mock('../../shared/api/attemptApi', () => ({
  getAttemptById: vi.fn(),
  getAttemptVideoProcessingProgressByTrackingId: vi.fn(),
}));

vi.mock('../../shared/api/challengeApi', () => ({
  getChallengeById: vi.fn(),
}));

const mockedGetAttemptById = vi.mocked(getAttemptById);
const mockedGetAttemptVideoProcessingProgressByTrackingId = vi.mocked(getAttemptVideoProcessingProgressByTrackingId);
const mockedGetChallengeById = vi.mocked(getChallengeById);

describe('AttemptResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    mockedGetChallengeById.mockResolvedValue(buildChallenge());
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
      strongestArea: 'pose shape',
      weakestArea: 'pose timing',
      judgementTimeline: [],
    });

    mockedGetAttemptById.mockImplementation(async (targetId) =>
      Number(targetId) === 10 ? pendingAttempt : completedAttempt,
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

    expect(await screen.findByText('Analysis is still running.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '갱신' }));

    expect(await screen.findByText('Completed result')).toBeInTheDocument();
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
      strongestArea: 'detection quality',
      weakestArea: 'pose shape',
      judgementTimeline: [],
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

    expect(await screen.findByText('Analysis is still running.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '갱신' }));

    expect(await screen.findByText('Kick result ready')).toBeInTheDocument();
    expect(screen.getByText('Refreshed same-result summary.')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetAttemptById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: '갱신' })).not.toBeInTheDocument();
  });

  it('renders score spot insights and timeline cards for auto-scored attempts', async () => {
    mockedGetAttemptById.mockResolvedValue(
      buildAttemptSummary({
        id: 31,
        challengeId: 42,
        challengeTitle: 'Wave Combo',
        score: 89,
        status: 'Completed',
        resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
        scoreAvailable: true,
        resultHeadline: 'Wave result ready',
        resultSummary: 'Auto-scored result summary.',
        processingMode: 'SYNC_INLINE',
        processingComplete: true,
        processingNotice: null,
        pendingTrackingId: null,
        durableProgressStatus: 'COMPLETED',
        completionStrategy: 'INLINE_FLOW',
        poseSimilarity: 92,
        timingSimilarity: 86,
        stabilitySimilarity: 81,
        strongestArea: 'pose shape',
        weakestArea: 'pose timing',
        retryFocus: 'Keep the next retry tighter on pose timing first.',
        keepStableFocus: 'Keep pose shape stable on the next retry.',
        judgementTimeline: [
          {
            id: 1,
            beatIndex: 0,
            second: 0,
            triggerMs: 0,
            windowMs: 180,
            lane: 1,
            accent: true,
            combo: 1,
            verdict: 'PERFECT',
            source: 'motion-analysis',
            offsetMs: 4,
            confidence: 0.96,
          },
          {
            id: 2,
            beatIndex: 1,
            second: 1,
            triggerMs: 1000,
            windowMs: 180,
            lane: 2,
            accent: false,
            combo: 0,
            verdict: 'LATE',
            source: 'motion-analysis',
            offsetMs: 28,
            confidence: 0.74,
          },
          {
            id: 3,
            beatIndex: 2,
            second: 2,
            triggerMs: 2000,
            windowMs: 180,
            lane: 4,
            accent: false,
            combo: 0,
            verdict: 'MISS',
            source: 'motion-analysis',
            offsetMs: -64,
            confidence: 0.41,
          },
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts/31/result']}>
        <Routes>
          <Route path="/attempts/:id/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('초당 Spot 분석')).toBeInTheDocument();
    expect(screen.getByText('구간 인사이트')).toBeInTheDocument();
    expect(screen.getByText('Spot 목록')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '하이라이트 보기' })).toBeInTheDocument();
    expect(screen.getAllByText('PERFECT').length).toBeGreaterThan(0);
    expect(screen.getByText('LATE')).toBeInTheDocument();
    expect(screen.getByText('MISS')).toBeInTheDocument();
  });
});

function buildChallenge() {
  return {
    id: 99,
    title: 'Reference Challenge',
    description: 'Reference challenge description',
    category: 'dance',
    difficulty: 'medium',
    thumbnailUrl: null,
    fallbackThumbnailVideoUrl: '/uploads/challenges/99/reference.mp4',
    guideVideoUrl: null,
    durationSec: 18,
    isActive: true,
    referenceAnalysisStatus: 'COMPLETED' as const,
    referenceVideoUploaded: true,
    referenceMotionProfileReady: true,
    referenceVideoOriginalFileName: 'reference.mp4',
    referenceAnalyzedAt: '2026-04-20T10:00:00Z',
    reviewCount: 0,
    averageRating: null,
    latestRetrySummary: null,
  };
}

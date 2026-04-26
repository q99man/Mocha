import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { getAttemptById } from '../../shared/api/attemptApi';
import { getChallengeById } from '../../shared/api/challengeApi';
import { buildAttemptSummary } from '../../test/fixtures/attemptFixtures';
import { AttemptResultPage } from '../AttemptResultPage';

vi.mock('../../shared/api/attemptApi', () => ({
  getAttemptById: vi.fn(),
  getAttemptVideoProcessingProgressByTrackingId: vi.fn(),
}));

vi.mock('../../shared/api/challengeApi', () => ({
  getChallengeById: vi.fn(),
}));

const mockedGetAttemptById = vi.mocked(getAttemptById);
const mockedGetChallengeById = vi.mocked(getChallengeById);

describe('AttemptResultPage final feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetChallengeById.mockResolvedValue({
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('prefers final feedback over raw analysis copy', async () => {
    mockedGetAttemptById.mockResolvedValue(
      buildAttemptSummary({
        id: 51,
        challengeId: 99,
        challengeTitle: 'Body Wave',
        score: 84,
        status: 'Completed',
        resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
        scoreAvailable: true,
        resultHeadline: 'Raw headline',
        resultSummary: 'Raw summary',
        processingMode: 'SYNC_INLINE',
        processingComplete: true,
        processingNotice: null,
        finalFeedback: {
          grade: 'GREAT',
          badge: 'GREAT',
          headline: 'Great run',
          summary: 'This run is close to top-tier quality. Tighten the beat match on the next take.',
          rhythmLabel: 'Building consistency',
          focusLabel: 'Tighten the beat match on the next take.',
          cleared: true,
        },
        judgementTimeline: [],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts/51/result']}>
        <Routes>
          <Route path="/attempts/:id/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Great run')).toBeInTheDocument();
    expect(screen.getAllByText('GREAT').length).toBeGreaterThan(0);
    expect(screen.getByText('This run is close to top-tier quality. Tighten the beat match on the next take.')).toBeInTheDocument();
    expect(screen.getAllByText('Building consistency').length).toBeGreaterThan(0);
    expect(screen.getAllByText('클리어').length).toBeGreaterThan(0);
    expect(screen.getByText('Focus: Tighten the beat match on the next take.')).toBeInTheDocument();
    expect(screen.queryByText('Raw headline')).not.toBeInTheDocument();
  });
});

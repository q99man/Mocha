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

    expect(await screen.findByText('Result analysis is still running.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));

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

    expect(await screen.findByText('Result analysis is still running.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));

    expect(await screen.findByText('Kick result ready')).toBeInTheDocument();
    expect(screen.getByText('Refreshed same-result summary.')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetAttemptById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Refresh status' })).not.toBeInTheDocument();
  });

  it('renders judgement insights when motion-analysis timeline data exists', async () => {
    mockedGetAttemptById.mockResolvedValue(
      buildAttemptSummary({
        id: 31,
        challengeId: 88,
        challengeTitle: 'Shoulder Wave',
        attemptVideoUrl: '/uploads/attempts/88/replay.mp4',
        score: 82,
        status: 'Completed',
        resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
        scoreAvailable: true,
        resultHeadline: 'Shoulder Wave cleared',
        resultSummary: 'Motion analysis summary is ready.',
        processingMode: 'SYNC_INLINE',
        processingComplete: true,
        processingNotice: null,
        pendingTrackingId: null,
        durableProgressStatus: 'COMPLETED',
        completionStrategy: 'INLINE_FLOW',
        judgementTimeline: [
          {
            id: 1,
            beatIndex: 0,
            second: 0,
            triggerMs: 320,
            windowMs: 200,
            lane: 0,
            accent: true,
            combo: 1,
            verdict: 'PERFECT',
            source: 'motion-analysis',
            offsetMs: -4,
            confidence: 0.96,
          },
          {
            id: 2,
            beatIndex: 1,
            second: 1,
            triggerMs: 970,
            windowMs: 200,
            lane: 1,
            accent: false,
            combo: 0,
            verdict: 'LATE',
            source: 'motion-analysis',
            offsetMs: 26,
            confidence: 0.73,
          },
          {
            id: 3,
            beatIndex: 2,
            second: 1,
            triggerMs: 1540,
            windowMs: 200,
            lane: 2,
            accent: false,
            combo: 0,
            verdict: 'LATE',
            source: 'motion-analysis',
            offsetMs: 34,
            confidence: 0.69,
          },
          {
            id: 4,
            beatIndex: 3,
            second: 3,
            triggerMs: 2120,
            windowMs: 200,
            lane: 3,
            accent: false,
            combo: 0,
            verdict: 'MISS',
            source: 'motion-analysis',
            offsetMs: 88,
            confidence: 0.41,
          },
          {
            id: 5,
            beatIndex: 4,
            second: 4,
            triggerMs: 2780,
            windowMs: 200,
            lane: 4,
            accent: true,
            combo: 1,
            verdict: 'GOOD',
            source: 'motion-analysis',
            offsetMs: 22,
            confidence: 0.81,
          },
          {
            id: 6,
            beatIndex: 5,
            second: 5,
            triggerMs: 3360,
            windowMs: 200,
            lane: 5,
            accent: false,
            combo: 2,
            verdict: 'GOOD',
            source: 'motion-analysis',
            offsetMs: 18,
            confidence: 0.84,
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

    expect(await screen.findByText('Judgement Insights')).toBeInTheDocument();
    expect(screen.getByText('Flow stability')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Timing drift')).toBeInTheDocument();
    expect(screen.getByText('Mostly late')).toBeInTheDocument();
    expect(screen.getByText('Weak section')).toBeInTheDocument();
    expect(screen.getByText('01-03 sec')).toBeInTheDocument();
    expect(screen.getByText('Comparison Replay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to first cue' })).toBeInTheDocument();
    expect(screen.getByText('Replay timeline')).toBeInTheDocument();
    expect(screen.getByText('Attempt')).toBeInTheDocument();
    expect(screen.getByText('Reference')).toBeInTheDocument();
    expect(screen.getByText('Judgement Replay')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Late' }));

    expect(screen.getByText('Late · 2/6 cues')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jump to cue 1 at 01 seconds' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to cue 2 at 02 seconds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to cue 3 at 02 seconds' })).toBeInTheDocument();
  });

  it('seeks both replay videos when a scrub marker is clicked', async () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playSpy,
    });

    mockedGetAttemptById.mockResolvedValue(
      buildAttemptSummary({
        id: 41,
        challengeId: 99,
        challengeTitle: 'Body Roll',
        attemptVideoUrl: '/uploads/attempts/99/replay.mp4',
        score: 79,
        status: 'Completed',
        resultSource: 'VIDEO_UPLOAD_AUTOSCORED',
        scoreAvailable: true,
        resultHeadline: 'Body Roll ready',
        resultSummary: 'Replay ready.',
        processingMode: 'SYNC_INLINE',
        processingComplete: true,
        processingNotice: null,
        pendingTrackingId: null,
        judgementTimeline: [
          {
            id: 7,
            beatIndex: 0,
            second: 2,
            triggerMs: 2400,
            windowMs: 200,
            lane: 2,
            accent: false,
            combo: 1,
            verdict: 'GOOD',
            source: 'motion-analysis',
            offsetMs: 16,
            confidence: 0.8,
          },
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/attempts/41/result']}>
        <Routes>
          <Route path="/attempts/:id/result" element={<AttemptResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Comparison Replay')).toBeInTheDocument();

    const replayVideos = document.querySelectorAll('video');
    const attemptVideo = replayVideos.item(0) as HTMLVideoElement | null;
    const referenceVideo = replayVideos.item(1) as HTMLVideoElement | null;
    expect(attemptVideo).not.toBeNull();
    expect(referenceVideo).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Scrub to cue 7' }));

    expect(attemptVideo?.currentTime).toBeCloseTo(2.22, 2);
    expect(referenceVideo?.currentTime).toBeCloseTo(2.22, 2);
    expect(playSpy).toHaveBeenCalled();
    expect(screen.getByText('Cue 07 · 03 sec')).toBeInTheDocument();
    expect(screen.getByText('Stabilize the section')).toBeInTheDocument();
    expect(screen.getByText(/GROOVE around 03 sec/i)).toBeInTheDocument();
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
    latestRetrySummary: null,
  };
}

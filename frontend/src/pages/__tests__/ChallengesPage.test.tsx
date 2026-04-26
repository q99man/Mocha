import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAttempts } from '../../shared/api/attemptApi';
import { getChallenges, likeChallenge, unlikeChallenge } from '../../shared/api/challengeApi';
import { createChallengeReview, getChallengeReviews } from '../../shared/api/reviewApi';
import { useAuth } from '../../shared/auth/AuthProvider';
import type { Challenge } from '../../shared/types/challenge';
import { ChallengesPage } from '../ChallengesPage';

vi.mock('../../shared/api/attemptApi', () => ({
  getAttempts: vi.fn(),
}));

vi.mock('../../shared/api/challengeApi', () => ({
  getChallenges: vi.fn(),
  likeChallenge: vi.fn(),
  unlikeChallenge: vi.fn(),
}));

vi.mock('../../shared/api/reviewApi', () => ({
  createChallengeReview: vi.fn(),
  getChallengeReviews: vi.fn(),
  removeReview: vi.fn(),
  updateReview: vi.fn(),
}));

vi.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockedGetAttempts = vi.mocked(getAttempts);
const mockedGetChallenges = vi.mocked(getChallenges);
const mockedLikeChallenge = vi.mocked(likeChallenge);
const mockedUnlikeChallenge = vi.mocked(unlikeChallenge);
const mockedCreateChallengeReview = vi.mocked(createChallengeReview);
const mockedGetChallengeReviews = vi.mocked(getChallengeReviews);
const mockedUseAuth = vi.mocked(useAuth);

describe('ChallengesPage', () => {
  let playMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    playMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    mockedGetAttempts.mockResolvedValue([]);
    mockedCreateChallengeReview.mockResolvedValue(buildReview());
    mockedGetChallengeReviews.mockResolvedValue([]);
    mockedLikeChallenge.mockImplementation(async (challengeId) =>
      buildChallenge({
        id: challengeId,
        title: challengeId === 1 ? 'First Challenge' : 'Second Challenge',
        fallbackThumbnailVideoUrl: challengeId === 1 ? '/uploads/first.mp4' : '/uploads/second.mp4',
        likeCount: 1,
        likedByCurrentMember: true,
      }),
    );
    mockedUnlikeChallenge.mockImplementation(async (challengeId) =>
      buildChallenge({
        id: challengeId,
        title: challengeId === 1 ? 'First Challenge' : 'Second Challenge',
        fallbackThumbnailVideoUrl: challengeId === 1 ? '/uploads/first.mp4' : '/uploads/second.mp4',
        likeCount: 0,
        likedByCurrentMember: false,
      }),
    );
    mockedGetChallenges.mockResolvedValue([
      buildChallenge({ id: 1, title: 'First Challenge', fallbackThumbnailVideoUrl: '/uploads/first.mp4' }),
      buildChallenge({ id: 2, title: 'Second Challenge', fallbackThumbnailVideoUrl: '/uploads/second.mp4' }),
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the left preview moving when opening reviews for an unselected challenge', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Routes>
          <Route path="/challenges" element={<ChallengesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('First Challenge');
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));

    const reviewButtons = container.querySelectorAll<HTMLButtonElement>('.song-select__item-review-btn');
    expect(reviewButtons).toHaveLength(2);

    fireEvent.click(reviewButtons[1]);

    await screen.findAllByText('Second Challenge');
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    expect(container.querySelector('video')?.getAttribute('src')).toBe('http://localhost:8080/uploads/second.mp4');
  });

  it('updates the list rating immediately after submitting a review and returning to the list', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 10,
        email: 'member@example.com',
        displayName: 'Member',
        authProvider: 'LOCAL',
        role: 'USER',
        authenticated: true,
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    mockedGetAttempts.mockResolvedValue([
      {
        id: 101,
        challengeId: 1,
        challengeTitle: 'First Challenge',
        score: 82,
        submittedAt: '2026-04-20T10:00:00Z',
        metrics: [],
        coachMessage: null,
        weakestArea: null,
        strongestArea: null,
      },
    ] as any);
    mockedCreateChallengeReview.mockResolvedValue(buildReview({ rating: 4 }));

    const { container } = render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Routes>
          <Route path="/challenges" element={<ChallengesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('First Challenge');

    const reviewButtons = container.querySelectorAll<HTMLButtonElement>('.song-select__item-review-btn');
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => expect(mockedGetChallengeReviews).toHaveBeenCalledWith(1));

    const composeButton = container.querySelector<HTMLButtonElement>('.song-select__review-panel-actions .song-select__panel-btn');
    expect(composeButton).not.toBeNull();
    fireEvent.click(composeButton!);

    const textarea = container.querySelector<HTMLTextAreaElement>('.song-select__review-compose textarea');
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: '좋은 챌린지였습니다.' } });

    const submitButton = container.querySelector<HTMLButtonElement>('.song-select__review-compose button[type="submit"]');
    expect(submitButton).not.toBeNull();
    fireEvent.click(submitButton!);

    await waitFor(() => expect(mockedCreateChallengeReview).toHaveBeenCalledWith(1, {
      rating: 5,
      content: '좋은 챌린지였습니다.',
    }));

    const backButton = container.querySelector<HTMLButtonElement>('.song-select__review-panel-actions .song-select__panel-btn');
    expect(backButton).not.toBeNull();
    fireEvent.click(backButton!);

    await waitFor(() => {
      const firstRating = container.querySelector('.song-select__item-rating:not(.song-select__item-rating--empty)');
      expect(firstRating?.textContent).toContain('4.0');
    });
  });

  it('toggles a challenge like in place for an authenticated member', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 10,
        email: 'member@example.com',
        displayName: 'Member',
        authProvider: 'LOCAL',
        role: 'USER',
        authenticated: true,
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Routes>
          <Route path="/challenges" element={<ChallengesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('First Challenge');

    const likeButtons = container.querySelectorAll<HTMLButtonElement>('.song-select__item-like-btn');
    expect(likeButtons).toHaveLength(2);
    fireEvent.click(likeButtons[0]);

    await waitFor(() => expect(mockedLikeChallenge).toHaveBeenCalledWith(1));
    await waitFor(() => {
      const updatedLikeButtons = container.querySelectorAll<HTMLButtonElement>('.song-select__item-like-btn');
      expect(updatedLikeButtons[0].textContent).toContain('1');
      expect(updatedLikeButtons[0].getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('keeps the left preview moving when liking an unselected challenge', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 10,
        email: 'member@example.com',
        displayName: 'Member',
        authProvider: 'LOCAL',
        role: 'USER',
        authenticated: true,
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Routes>
          <Route path="/challenges" element={<ChallengesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('First Challenge');
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));

    const likeButtons = container.querySelectorAll<HTMLButtonElement>('.song-select__item-like-btn');
    fireEvent.click(likeButtons[1]);

    await waitFor(() => expect(mockedLikeChallenge).toHaveBeenCalledWith(2));
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    expect(container.querySelector('video')?.getAttribute('src')).toBe('http://localhost:8080/uploads/second.mp4');
  });
});

function buildChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 1,
    title: 'Challenge',
    description: 'Challenge description',
    category: 'dance',
    difficulty: 'medium',
    thumbnailUrl: null,
    fallbackThumbnailVideoUrl: '/uploads/reference.mp4',
    guideVideoUrl: null,
    durationSec: 18,
    isActive: true,
    referenceAnalysisStatus: 'COMPLETED',
    referenceVideoUploaded: true,
    referenceMotionProfileReady: true,
    referenceVideoOriginalFileName: 'reference.mp4',
    referenceAnalyzedAt: '2026-04-20T10:00:00Z',
    reviewCount: 0,
    averageRating: null,
    likeCount: 0,
    likedByCurrentMember: false,
    latestRetrySummary: null,
    ...overrides,
  };
}

function buildReview(overrides = {}) {
  return {
    id: 201,
    boardPostId: null,
    challengeId: 1,
    challengeTitle: 'First Challenge',
    memberId: 10,
    memberDisplayName: 'Member',
    rating: 4,
    content: '좋은 챌린지였습니다.',
    mine: true,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
    ...overrides,
  };
}

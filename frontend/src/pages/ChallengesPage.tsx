import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { CameraSetupModal } from '../features/challenges/CameraSetupModal';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { ReviewStars } from '../features/reviews/ReviewStars';
import { getAttempts } from '../shared/api/attemptApi';
import { getChallenges } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import { createChallengeReview, getChallengeReviews, removeReview, updateReview } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import type { Challenge } from '../shared/types/challenge';
import type { Review, ReviewInput } from '../shared/types/review';

type ChallengeFilter = 'ALL' | 'NEW' | 'REVIEWED';
type RightPanel = 'list' | 'reviews';

const AUDIO_FADE_MS = 400;
const AUDIO_TARGET_VOLUME = 0.6;
const INITIAL_REVIEW_FORM: ReviewInput = {
  rating: 5,
  content: '',
};

type ChallengeReviewConfirmState =
  | { type: 'none' }
  | { type: 'delete-review'; reviewId: number };

export function ChallengesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalChallengeId, setModalChallengeId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>(
    searchParams.get('panel') === 'reviews' ? 'reviews' : 'list',
  );
  const [attemptedChallengeIds, setAttemptedChallengeIds] = useState<number[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewsByChallengeId, setReviewsByChallengeId] = useState<Record<number, Review[]>>({});

  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewInput>(INITIAL_REVIEW_FORM);
  const [reviewSubmitBusy, setReviewSubmitBusy] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState<string | null>(null);

  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewEditForm, setReviewEditForm] = useState<ReviewInput>(INITIAL_REVIEW_FORM);
  const [reviewEditBusy, setReviewEditBusy] = useState(false);
  const [reviewEditError, setReviewEditError] = useState<string | null>(null);
  const [reviewEditSuccess, setReviewEditSuccess] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ChallengeReviewConfirmState>({ type: 'none' });

  const audioRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const selectDebounceRef = useRef<number | null>(null);
  const firstPreviewStartedRef = useRef(false);
  const challengeItemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const selectedChallengeIdFromQuery = Number(searchParams.get('challengeId') ?? '');
  const modalChallenge = useMemo(
    () => (modalChallengeId != null ? challenges.find((challenge) => challenge.id === modalChallengeId) ?? null : null),
    [challenges, modalChallengeId],
  );

  useEffect(() => {
    let active = true;

    async function loadChallenges() {
      setLoading(true);
      setError(null);

      try {
        const response = await getChallenges();
        if (!active) {
          return;
        }

        setChallenges(response);
        if (response.length > 0) {
          const initialChallenge =
            Number.isFinite(selectedChallengeIdFromQuery) && selectedChallengeIdFromQuery > 0
              ? response.find((challenge) => challenge.id === selectedChallengeIdFromQuery) ?? response[0]
              : response[0];
          setSelectedId(initialChallenge.id);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '챌린지 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenges();

    return () => {
      active = false;
    };
  }, [selectedChallengeIdFromQuery]);

  useEffect(() => {
    setActivePanel(searchParams.get('panel') === 'reviews' ? 'reviews' : 'list');
  }, [searchParams]);

  useEffect(() => {
    if (!Number.isFinite(selectedChallengeIdFromQuery) || selectedChallengeIdFromQuery <= 0) {
      return;
    }

    const challenge = challenges.find((item) => item.id === selectedChallengeIdFromQuery);
    if (challenge) {
      setSelectedId(challenge.id);
    }
  }, [challenges, selectedChallengeIdFromQuery]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setAttemptedChallengeIds([]);
      return;
    }

    let active = true;

    async function loadAttempts() {
      try {
        const attempts = await getAttempts();
        if (!active) {
          return;
        }

        setAttemptedChallengeIds(Array.from(new Set(attempts.map((attempt) => attempt.challengeId))));
      } catch {
        if (active) {
          setAttemptedChallengeIds([]);
        }
      }
    }

    void loadAttempts();

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
      }
      if (selectDebounceRef.current) {
        window.clearTimeout(selectDebounceRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const selectedChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === selectedId) ?? null,
    [challenges, selectedId],
  );

  useEffect(() => {
    if (activePanel !== 'list' || selectedId == null) {
      return;
    }

    const selectedItem = challengeItemRefs.current[selectedId];
    if (!selectedItem) {
      return;
    }

    window.requestAnimationFrame(() => {
      selectedItem.focus({ preventScroll: true });
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [activePanel, selectedId]);

  useEffect(() => {
    setReviewFormOpen(false);
    setReviewForm(INITIAL_REVIEW_FORM);
    setReviewSubmitBusy(false);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
    setEditingReviewId(null);
    setReviewEditForm(INITIAL_REVIEW_FORM);
    setReviewEditBusy(false);
    setReviewEditError(null);
    setReviewEditSuccess(null);
    setConfirmState({ type: 'none' });
  }, [activePanel, selectedChallenge?.id]);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as const, label: '전체', count: challenges.length },
      {
        key: 'NEW' as const,
        label: '신규',
        count: challenges.filter((challenge) => !challenge.latestRetrySummary).length,
      },
      {
        key: 'REVIEWED' as const,
        label: '기록 있음',
        count: challenges.filter((challenge) => Boolean(challenge.latestRetrySummary)).length,
      },
    ],
    [challenges],
  );

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (activeFilter === 'NEW') {
        return !challenge.latestRetrySummary;
      }
      if (activeFilter === 'REVIEWED') {
        return Boolean(challenge.latestRetrySummary);
      }
      return true;
    });
  }, [activeFilter, challenges]);

  const selectedChallengeReviews = selectedChallenge ? reviewsByChallengeId[selectedChallenge.id] ?? [] : [];
  const hasAttemptedSelectedChallenge = Boolean(
    selectedChallenge &&
      (attemptedChallengeIds.includes(selectedChallenge.id) || selectedChallenge.latestRetrySummary),
  );
  const hasMyReview = Boolean(
    selectedChallenge &&
      selectedChallengeReviews.some((review) => review.mine || (user != null && review.memberId === user.id)),
  );
  const canWriteReview = Boolean(selectedChallenge && isAuthenticated && hasAttemptedSelectedChallenge && !hasMyReview);

  useEffect(() => {
    if (!selectedChallenge || activePanel !== 'reviews') {
      return;
    }

    const challengeId = selectedChallenge.id;
    if (reviewsByChallengeId[challengeId]) {
      return;
    }

    let active = true;

    async function loadReviews() {
      setReviewLoading(true);
      setReviewError(null);

      try {
        const reviews = await getChallengeReviews(challengeId);
        if (active) {
          setReviewsByChallengeId((current) => ({ ...current, [challengeId]: reviews }));
        }
      } catch (loadError) {
        if (active) {
          setReviewError(loadError instanceof Error ? loadError.message : '후기를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setReviewLoading(false);
        }
      }
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [activePanel, reviewsByChallengeId, selectedChallenge]);

  const fadeOutAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      if (fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
      }

      const step = Math.max(audio.volume / (AUDIO_FADE_MS / 30), 0.05);
      fadeTimerRef.current = window.setInterval(() => {
        if (audio.volume - step <= 0) {
          audio.volume = 0;
          audio.pause();
          if (fadeTimerRef.current) {
            window.clearInterval(fadeTimerRef.current);
          }
          fadeTimerRef.current = null;
          resolve();
        } else {
          audio.volume = Math.max(0, audio.volume - step);
        }
      }, 30);
    });
  }, []);

  const playPreviewAudio = useCallback(async (src: string, options?: { autoplay?: boolean }) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    audio.src = src;
    audio.loop = true;
    audio.currentTime = 0;
    audio.volume = 0;
    audio.muted = Boolean(options?.autoplay);

    try {
      await audio.play();
    } catch {
      return;
    }

    if (options?.autoplay) {
      window.setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.muted = false;
        }
      }, 80);
    }

    const step = AUDIO_TARGET_VOLUME / (AUDIO_FADE_MS / 30);
    fadeTimerRef.current = window.setInterval(() => {
      const currentAudio = audioRef.current;
      if (!currentAudio) {
        if (fadeTimerRef.current) {
          window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        return;
      }

      if (currentAudio.volume + step >= AUDIO_TARGET_VOLUME) {
        currentAudio.volume = AUDIO_TARGET_VOLUME;
        if (fadeTimerRef.current) {
          window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
      } else {
        currentAudio.volume = Math.min(AUDIO_TARGET_VOLUME, currentAudio.volume + step);
      }
    }, 30);
  }, []);

  const handleItemClick = useCallback(
    (challengeId: number) => {
      setSelectedId(challengeId);

      if (selectDebounceRef.current) {
        window.clearTimeout(selectDebounceRef.current);
      }

      selectDebounceRef.current = window.setTimeout(() => {
        const challenge = challenges.find((item) => item.id === challengeId);
        const videoUrl = challenge?.guideVideoUrl ?? challenge?.fallbackThumbnailVideoUrl ?? null;

        if (videoUrl) {
          void fadeOutAudio().then(() => playPreviewAudio(resolveApiUrl(videoUrl)));
        } else {
          void fadeOutAudio();
        }
      }, 200);
    },
    [challenges, fadeOutAudio, playPreviewAudio],
  );

  function handleItemKeyDown(event: KeyboardEvent<HTMLElement>, challengeId: number) {
    const currentIndex = filteredChallenges.findIndex((challenge) => challenge.id === challengeId);

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();

      if (currentIndex < 0 || filteredChallenges.length === 0) {
        return;
      }

      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(filteredChallenges.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      const nextChallenge = filteredChallenges[nextIndex];

      if (!nextChallenge || nextChallenge.id === challengeId) {
        return;
      }

      handleItemClick(nextChallenge.id);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedId(challengeId);
      setModalChallengeId(challengeId);
    }
  }

  function openReviewsPanel(challengeId?: number) {
    if (typeof challengeId === 'number') {
      handleItemClick(challengeId);
    }
    setActivePanel('reviews');
    setReviewError(null);
  }

  function openListPanel() {
    setActivePanel('list');
  }

  function openReviewForm() {
    setEditingReviewId(null);
    setReviewEditForm(INITIAL_REVIEW_FORM);
    setReviewEditError(null);
    setReviewEditSuccess(null);
    setConfirmState({ type: 'none' });
    setReviewFormOpen(true);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
  }

  function closeReviewForm() {
    setReviewFormOpen(false);
    setReviewForm(INITIAL_REVIEW_FORM);
    setReviewSubmitError(null);
    setConfirmState({ type: 'none' });
  }

  function handleStartReviewEdit(review: Review) {
    setReviewFormOpen(false);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
    setConfirmState({ type: 'none' });
    setEditingReviewId(review.id);
    setReviewEditForm({
      rating: review.rating,
      content: review.content,
    });
    setReviewEditError(null);
    setReviewEditSuccess(null);
  }

  function handleCancelReviewEdit() {
    setEditingReviewId(null);
    setReviewEditForm(INITIAL_REVIEW_FORM);
    setReviewEditError(null);
    setConfirmState({ type: 'none' });
  }

  async function handleReviewSubmit() {
    if (!selectedChallenge || !canWriteReview) {
      return;
    }

    const trimmedContent = reviewForm.content.trim();
    if (!trimmedContent) {
      setReviewSubmitError('후기 내용을 입력해 주세요.');
      return;
    }

    setReviewSubmitBusy(true);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);

    try {
      const createdReview = await createChallengeReview(selectedChallenge.id, {
        rating: reviewForm.rating,
        content: trimmedContent,
      });

      setReviewsByChallengeId((current) => ({
        ...current,
        [selectedChallenge.id]: [createdReview, ...(current[selectedChallenge.id] ?? [])],
      }));
      setReviewFormOpen(false);
      setReviewForm(INITIAL_REVIEW_FORM);
      setReviewSubmitSuccess('후기를 등록했습니다.');
    } catch (submitError) {
      setReviewSubmitError(submitError instanceof Error ? submitError.message : '후기를 등록하지 못했습니다.');
    } finally {
      setReviewSubmitBusy(false);
    }
  }

  async function handleReviewUpdate(reviewId: number) {
    if (!selectedChallenge) {
      return;
    }

    const trimmedContent = reviewEditForm.content.trim();
    if (!trimmedContent) {
      setReviewEditError('후기 내용을 입력해 주세요.');
      return;
    }

    setReviewEditBusy(true);
    setReviewEditError(null);
    setReviewEditSuccess(null);

    try {
      const updatedReview = await updateReview(reviewId, {
        rating: reviewEditForm.rating,
        content: trimmedContent,
      });

      setReviewsByChallengeId((current) => ({
        ...current,
        [selectedChallenge.id]: (current[selectedChallenge.id] ?? []).map((review) =>
          review.id === reviewId ? updatedReview : review,
        ),
      }));
      setEditingReviewId(null);
      setReviewEditForm(INITIAL_REVIEW_FORM);
      setReviewEditSuccess('후기를 수정했습니다.');
    } catch (submitError) {
      setReviewEditError(submitError instanceof Error ? submitError.message : '후기를 수정하지 못했습니다.');
    } finally {
      setReviewEditBusy(false);
    }
  }

  function handleReviewDelete(reviewId: number) {
    setConfirmState({ type: 'delete-review', reviewId });
  }

  async function confirmReviewDelete() {
    if (!selectedChallenge) {
      return;
    }

    if (confirmState.type !== 'delete-review') {
      return;
    }

    const { reviewId } = confirmState;
    setReviewEditBusy(true);
    setReviewEditError(null);
    setReviewEditSuccess(null);

    try {
      await removeReview(reviewId);
      setReviewsByChallengeId((current) => ({
        ...current,
        [selectedChallenge.id]: (current[selectedChallenge.id] ?? []).filter((review) => review.id !== reviewId),
      }));
      setEditingReviewId(null);
      setReviewEditForm(INITIAL_REVIEW_FORM);
      setReviewEditSuccess('후기를 삭제했습니다.');
    } catch (deleteError) {
      setReviewEditError(deleteError instanceof Error ? deleteError.message : '후기를 삭제하지 못했습니다.');
    } finally {
      setConfirmState({ type: 'none' });
      setReviewEditBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedChallenge || firstPreviewStartedRef.current) {
      return;
    }

    const videoUrl = selectedChallenge.guideVideoUrl ?? selectedChallenge.fallbackThumbnailVideoUrl ?? null;
    if (!videoUrl) {
      return;
    }

    firstPreviewStartedRef.current = true;
    void playPreviewAudio(resolveApiUrl(videoUrl), { autoplay: true });
  }, [playPreviewAudio, selectedChallenge]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 목록을 불러오는 중입니다.</strong>
          <p>플레이 가능한 챌린지를 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 목록을 불러오지 못했습니다.</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  const previewVideoUrl = selectedChallenge?.guideVideoUrl ?? selectedChallenge?.fallbackThumbnailVideoUrl ?? null;
  const resolvedPreviewUrl = previewVideoUrl ? resolveApiUrl(previewVideoUrl) : null;

  return (
    <div className="glass-page">
      <video ref={audioRef} style={{ display: 'none' }} playsInline preload="auto" />

      <div className="song-select">
        <div className="song-select__detail song-select__detail--video-fill">
          {selectedChallenge && resolvedPreviewUrl ? (
            <video
              key={selectedChallenge.id}
              className="song-select__bg-video"
              src={resolvedPreviewUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          ) : selectedChallenge ? (
            <div className="song-select__bg-video-placeholder">
              <ChallengeVisual
                title={selectedChallenge.title}
                thumbnailUrl={selectedChallenge.thumbnailUrl}
                fallbackThumbnailVideoUrl={selectedChallenge.fallbackThumbnailVideoUrl}
                className=""
                placeholderClassName=""
              />
            </div>
          ) : null}

          <div className="song-select__detail-gradient" />

          {selectedChallenge ? (
            <div className="song-select__detail-overlay">
              <div className="song-select__detail-content">
                <h2 className="song-select__title song-select__title--overlay">{selectedChallenge.title}</h2>
              </div>

              <div className="song-select__actions">
                <button
                  type="button"
                  className="song-select__action-btn"
                  onClick={() => setModalChallengeId(selectedChallenge.id)}
                >
                  도전 시작
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="song-select__list-pane">
          <div className="song-select__filter-bar">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`song-select__filter-tab${activeFilter === option.key ? ' song-select__filter-tab--active' : ''}`}
                onClick={() => {
                  setActiveFilter(option.key);
                  setActivePanel('list');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {activePanel === 'list' ? (
            <div className="song-select__list">
              {filteredChallenges.length === 0 ? (
                <div className="song-select__empty">
                  <p>조건에 맞는 챌린지가 없습니다.</p>
                </div>
              ) : (
                filteredChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    ref={(node) => {
                      challengeItemRefs.current[challenge.id] = node;
                    }}
                    className={`song-select__item${selectedId === challenge.id ? ' song-select__item--active' : ''}`}
                    role="button"
                    tabIndex={selectedId === challenge.id ? 0 : -1}
                    onClick={() => handleItemClick(challenge.id)}
                    onKeyDown={(event) => handleItemKeyDown(event, challenge.id)}
                    onFocus={() => {
                      setSelectedId(challenge.id);
                    }}
                    onDoubleClick={() => {
                      setSelectedId(challenge.id);
                      setModalChallengeId(challenge.id);
                    }}
                  >
                    <div className="song-select__item-thumb">
                      <div className="song-select__item-difficulty">
                        <strong>{formatDifficulty(challenge.difficulty)}</strong>
                      </div>
                    </div>

                    <div className="song-select__item-info">
                      <span className="song-select__item-title">{challenge.title}</span>
                      <span className="song-select__item-sub">
                        {challenge.category} · {formatDuration(challenge.durationSec)}
                      </span>
                    </div>

                    <div className="song-select__item-actions">
                      <button
                        type="button"
                        className="song-select__item-review-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          openReviewsPanel(challenge.id);
                        }}
                      >
                        후기
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="song-select__review-panel">
              <div className="song-select__review-panel-header">
                <div>
                  <strong>{selectedChallenge?.title ?? '챌린지 후기'}</strong>
                  <span>참여자 후기를 바로 확인할 수 있습니다.</span>
                </div>
                <div className="song-select__review-panel-actions">
                  {canWriteReview ? (
                    <button
                      type="button"
                      className={`song-select__panel-btn${reviewFormOpen ? ' is-active' : ''}`}
                      onClick={reviewFormOpen ? closeReviewForm : openReviewForm}
                    >
                      {reviewFormOpen ? '작성 닫기' : '후기 작성'}
                    </button>
                  ) : null}
                  <button type="button" className="song-select__panel-btn" onClick={openListPanel}>
                    목록으로
                  </button>
                </div>
              </div>

              {!isAuthenticated ? (
                <div className="song-select__review-notice">
                  로그인 후 도전한 챌린지에만 후기를 작성할 수 있습니다.
                </div>
              ) : !hasAttemptedSelectedChallenge ? (
                <div className="song-select__review-notice">
                  내가 도전한 챌린지에만 후기를 작성할 수 있습니다.
                </div>
              ) : hasMyReview ? (
                <div className="song-select__review-notice song-select__review-notice--done">
                  이 챌린지에는 이미 후기를 작성했습니다.
                </div>
              ) : null}

              {reviewFormOpen ? (
                <form
                  className="song-select__review-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleReviewSubmit();
                  }}
                >
                  <div className="song-select__review-compose-head">
                    <div>
                      <strong>후기 작성</strong>
                      <span>도전 경험을 바로 남겨 주세요.</span>
                    </div>
                    <div className="song-select__review-rating">
                      <ReviewStars
                        value={reviewForm.rating}
                        disabled={reviewSubmitBusy}
                        onChange={(nextRating) => setReviewForm((current) => ({ ...current, rating: nextRating }))}
                      />
                      <b>{reviewForm.rating.toFixed(1)}점</b>
                    </div>
                  </div>

                  <label className="song-select__review-field">
                    <span>후기 내용</span>
                    <textarea
                      value={reviewForm.content}
                      rows={5}
                      maxLength={1200}
                      disabled={reviewSubmitBusy}
                      placeholder="좋았던 점, 어려웠던 구간, 다시 도전할 때 참고할 내용을 적어 주세요."
                      onChange={(event) => setReviewForm((current) => ({ ...current, content: event.target.value }))}
                    />
                  </label>

                  <div className="song-select__review-compose-footer">
                    <span>{reviewForm.content.trim().length}/1200</span>
                    <div className="song-select__review-compose-buttons">
                      <button
                        type="button"
                        className="song-select__panel-btn"
                        onClick={closeReviewForm}
                        disabled={reviewSubmitBusy}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="song-select__item-review-btn"
                        disabled={reviewSubmitBusy || !reviewForm.content.trim()}
                      >
                        {reviewSubmitBusy ? '저장 중...' : '등록하기'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}

              {reviewSubmitSuccess ? (
                <p className="song-select__review-message song-select__review-message--success">{reviewSubmitSuccess}</p>
              ) : null}
              {reviewSubmitError ? (
                <p className="song-select__review-message song-select__review-message--error">{reviewSubmitError}</p>
              ) : null}
              {reviewEditSuccess ? (
                <p className="song-select__review-message song-select__review-message--success">{reviewEditSuccess}</p>
              ) : null}
              {reviewEditError && editingReviewId == null ? (
                <p className="song-select__review-message song-select__review-message--error">{reviewEditError}</p>
              ) : null}

              {reviewLoading ? (
                <div className="song-select__empty">
                  <p>후기를 불러오는 중입니다.</p>
                </div>
              ) : reviewError ? (
                <div className="song-select__empty">
                  <p>{reviewError}</p>
                </div>
              ) : selectedChallengeReviews.length === 0 ? (
                <div className="song-select__empty">
                  <p>아직 등록된 후기가 없습니다.</p>
                </div>
              ) : (
                selectedChallengeReviews.map((review) => {
                  const isMine = review.mine || (user != null && review.memberId === user.id);
                  const isEditing = editingReviewId === review.id;

                  return (
                    <article className="song-select__review-card" key={review.id}>
                      <div className="song-select__review-header">
                        <div>
                          <strong>{review.memberDisplayName}</strong>
                          <span>{formatReviewDate(review.updatedAt)}</span>
                        </div>
                        <div className="song-select__review-header-side">
                          <span className="song-select__review-score">{renderStars(review.rating)}</span>
                          {isMine ? <span className="song-select__review-mine">내 후기</span> : null}
                        </div>
                      </div>

                      {!isEditing ? (
                        <>
                          <p className="song-select__review-content">{review.content}</p>
                          {isMine ? (
                            <div className="song-select__review-actions">
                              <button
                                type="button"
                                className="song-select__panel-btn"
                                onClick={() => handleStartReviewEdit(review)}
                                disabled={reviewEditBusy}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="song-select__panel-btn song-select__panel-btn--danger"
                                onClick={() => handleReviewDelete(review.id)}
                                disabled={reviewEditBusy}
                              >
                                삭제
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="song-select__review-edit">
                          <div className="song-select__review-rating">
                            <ReviewStars
                              value={reviewEditForm.rating}
                              disabled={reviewEditBusy}
                              onChange={(nextRating) =>
                                setReviewEditForm((current) => ({ ...current, rating: nextRating }))
                              }
                            />
                            <b>{reviewEditForm.rating.toFixed(1)}점</b>
                          </div>

                          <label className="song-select__review-field">
                            <span>후기 내용</span>
                            <textarea
                              value={reviewEditForm.content}
                              rows={5}
                              maxLength={1200}
                              disabled={reviewEditBusy}
                              onChange={(event) =>
                                setReviewEditForm((current) => ({ ...current, content: event.target.value }))
                              }
                            />
                          </label>

                          <div className="song-select__review-compose-footer">
                            <span>{reviewEditForm.content.trim().length}/1200</span>
                            <div className="song-select__review-compose-buttons">
                              <button
                                type="button"
                                className="song-select__panel-btn"
                                onClick={handleCancelReviewEdit}
                                disabled={reviewEditBusy}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="song-select__item-review-btn"
                                onClick={() => void handleReviewUpdate(review.id)}
                                disabled={reviewEditBusy || !reviewEditForm.content.trim()}
                              >
                                {reviewEditBusy ? '저장 중...' : '수정 완료'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isEditing && reviewEditError ? (
                        <p className="song-select__review-message song-select__review-message--error">{reviewEditError}</p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {modalChallenge ? (
        <CameraSetupModal
          challengeTitle={modalChallenge.title}
          onConfirm={(mode) => {
            void fadeOutAudio();
            const targetId = modalChallenge.id;
            setModalChallengeId(null);
            void navigate(`/challenges/${targetId}/start${mode === 'test' ? '?mode=test' : ''}`);
          }}
          onClose={() => setModalChallengeId(null)}
        />
      ) : null}

      <CompactConfirmDialog
        open={confirmState.type === 'delete-review'}
        title="후기 삭제"
        description="선택한 후기를 삭제하면 이 챌린지의 후기 목록에서 바로 제외됩니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        tone="danger"
        busy={reviewEditBusy}
        onConfirm={confirmReviewDelete}
        onCancel={() => setConfirmState({ type: 'none' })}
      />
    </div>
  );
}

function formatDuration(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}초`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (seconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}

function formatReviewDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}

function renderStars(value: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
}

function formatDifficulty(value: string) {
  const normalized = value.trim();
  const numericText = normalized.match(/\d+/)?.[0] ?? '';
  const numeric = Number(numericText || normalized);

  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.min(10, Math.round(numeric)));
  }

  const difficultyMap: Record<string, number> = {
    쉬움: 2,
    보통: 5,
    어려움: 8,
    veryeasy: 1,
    easy: 3,
    normal: 5,
    medium: 5,
    hard: 7,
    expert: 9,
    insane: 10,
    beginner: 2,
    advanced: 8,
  };

  const compactKey = normalized.toLowerCase().replace(/\s+/g, '');
  return difficultyMap[compactKey] ?? 5;
}

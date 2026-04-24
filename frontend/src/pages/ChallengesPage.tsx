import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { CameraSetupModal } from '../features/challenges/CameraSetupModal';
import { ChallengeDetailHero } from '../features/challenges/ChallengeDetailHero';
import { ChallengeListPane } from '../features/challenges/ChallengeListPane';
import { ChallengeReviewsPane } from '../features/challenges/ChallengeReviewsPane';
import { getAttempts } from '../shared/api/attemptApi';
import { getChallenges } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import { createChallengeReview, getChallengeReviews, removeReview, updateReview } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import { CompactToast } from '../shared/components/CompactToast';
import { Pagination } from '../shared/components/Pagination';
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
const CHALLENGES_PER_PAGE = 10;

type ChallengeReviewConfirmState =
  | { type: 'none' }
  | { type: 'update-review'; reviewId: number }
  | { type: 'delete-review'; reviewId: number };

export function ChallengesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [challengePage, setChallengePage] = useState(1);
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
  }, [activePanel, challengePage, selectedId]);

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
  const challengeTotalPages = Math.max(1, Math.ceil(filteredChallenges.length / CHALLENGES_PER_PAGE));
  const pagedChallenges = useMemo(() => {
    const startIndex = (challengePage - 1) * CHALLENGES_PER_PAGE;
    return filteredChallenges.slice(startIndex, startIndex + CHALLENGES_PER_PAGE);
  }, [challengePage, filteredChallenges]);

  useEffect(() => {
    setChallengePage(1);
  }, [activeFilter]);

  useEffect(() => {
    if (challengePage > challengeTotalPages) {
      setChallengePage(challengeTotalPages);
    }
  }, [challengePage, challengeTotalPages]);

  useEffect(() => {
    if (activePanel !== 'list' || selectedId == null) {
      return;
    }

    const selectedIndex = filteredChallenges.findIndex((challenge) => challenge.id === selectedId);
    if (selectedIndex < 0) {
      return;
    }

    const selectedPage = Math.floor(selectedIndex / CHALLENGES_PER_PAGE) + 1;
    setChallengePage((current) => (current === selectedPage ? current : selectedPage));
  }, [activePanel, filteredChallenges, selectedId]);

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
  const activeReviewFeedbackError = reviewSubmitError || reviewEditError;
  const activeReviewFeedbackSuccess = reviewSubmitSuccess || reviewEditSuccess;

  function clearReviewFeedback() {
    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
    setReviewEditError(null);
    setReviewEditSuccess(null);
  }

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
        if (!audioRef.current) {
          resolve();
          return;
        }

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
    const targetChallengeId = typeof challengeId === 'number' ? challengeId : selectedId;

    if (typeof challengeId === 'number') {
      handleItemClick(challengeId);
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('panel', 'reviews');
        if (targetChallengeId != null) {
          next.set('challengeId', String(targetChallengeId));
        }
        return next;
      },
    );
    setActivePanel('reviews');
    setReviewError(null);
  }

  function openListPanel() {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('panel');
        if (selectedId != null) {
          next.set('challengeId', String(selectedId));
        }
        return next;
      },
    );
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

  function requestReviewUpdate(reviewId: number) {
    setConfirmState({ type: 'update-review', reviewId });
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

  async function confirmReviewUpdate() {
    if (confirmState.type !== 'update-review') {
      return;
    }

    const { reviewId } = confirmState;
    await handleReviewUpdate(reviewId);
    setConfirmState({ type: 'none' });
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
        <ChallengeDetailHero
          selectedChallenge={selectedChallenge}
          resolvedPreviewUrl={resolvedPreviewUrl}
          onOpenModal={setModalChallengeId}
        />

        <div className="song-select__list-pane">
          {activePanel === 'list' ? (
            <>
              <ChallengeListPane
                filterOptions={filterOptions}
                activeFilter={activeFilter}
                filteredChallenges={pagedChallenges}
                selectedId={selectedId}
                onSelectFilter={(filter) => {
                  setActiveFilter(filter);
                  setActivePanel('list');
                }}
                registerItemRef={(challengeId, node) => {
                  challengeItemRefs.current[challengeId] = node;
                }}
                onItemClick={handleItemClick}
                onItemKeyDown={handleItemKeyDown}
                onItemFocus={setSelectedId}
                onItemDoubleClick={(challengeId) => {
                  setSelectedId(challengeId);
                  setModalChallengeId(challengeId);
                }}
                onOpenReviews={openReviewsPanel}
                formatDuration={formatDuration}
                formatDifficulty={formatDifficulty}
              />
              <Pagination currentPage={challengePage} totalPages={challengeTotalPages} onPageChange={setChallengePage} />
            </>
          ) : (
            <ChallengeReviewsPane
              selectedChallenge={selectedChallenge}
              isAuthenticated={isAuthenticated}
              hasAttemptedSelectedChallenge={hasAttemptedSelectedChallenge}
              hasMyReview={hasMyReview}
              canWriteReview={canWriteReview}
              reviewFormOpen={reviewFormOpen}
              reviewForm={reviewForm}
              reviewSubmitBusy={reviewSubmitBusy}
              reviewLoading={reviewLoading}
              reviewError={reviewError}
              selectedChallengeReviews={selectedChallengeReviews}
              editingReviewId={editingReviewId}
              reviewEditForm={reviewEditForm}
              reviewEditBusy={reviewEditBusy}
              currentUserId={user?.id}
              setReviewForm={setReviewForm}
              setReviewEditForm={setReviewEditForm}
              onToggleReviewForm={() => {
                if (reviewFormOpen) {
                  closeReviewForm();
                } else {
                  openReviewForm();
                }
              }}
              onOpenListPanel={openListPanel}
              onSubmitReview={handleReviewSubmit}
              onStartReviewEdit={handleStartReviewEdit}
              onDeleteReview={handleReviewDelete}
              onCancelReviewEdit={handleCancelReviewEdit}
              onRequestReviewUpdate={requestReviewUpdate}
              formatReviewDate={formatReviewDate}
              renderStars={renderStars}
            />
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
        open={confirmState.type !== 'none'}
        title={confirmState.type === 'update-review' ? '후기 수정' : '후기 삭제'}
        description={
          confirmState.type === 'update-review'
            ? '입력한 내용으로 후기를 수정합니다. 변경사항은 챌린지 후기 목록에 바로 반영됩니다.'
            : '선택한 후기를 삭제하면 챌린지 후기 목록에서 바로 사라집니다.'
        }
        confirmLabel={confirmState.type === 'update-review' ? '수정' : '삭제'}
        cancelLabel="취소"
        tone={confirmState.type === 'update-review' ? 'default' : 'danger'}
        busy={reviewEditBusy}
        onConfirm={confirmState.type === 'update-review' ? confirmReviewUpdate : confirmReviewDelete}
        onCancel={() => setConfirmState({ type: 'none' })}
      />

      <CompactToast
        message={activeReviewFeedbackError || activeReviewFeedbackSuccess}
        type={activeReviewFeedbackError ? 'error' : 'success'}
        onClose={clearReviewFeedback}
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

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { CameraSetupModal } from '../features/challenges/CameraSetupModal';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { getChallenges } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import { getChallengeReviews } from '../shared/api/reviewApi';
import type { Challenge } from '../shared/types/challenge';
import type { Review } from '../shared/types/review';

type ChallengeFilter = 'ALL' | 'NEW' | 'REVIEWED';
type RightPanel = 'list' | 'reviews';

const AUDIO_FADE_MS = 400;
const AUDIO_TARGET_VOLUME = 0.6;

export function ChallengesPage() {
  const navigate = useNavigate();
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
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewsByChallengeId, setReviewsByChallengeId] = useState<Record<number, Review[]>>({});

  const audioRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const selectDebounceRef = useRef<number | null>(null);
  const firstPreviewStartedRef = useRef(false);

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
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(challengeId);
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
                    className={`song-select__item${selectedId === challenge.id ? ' song-select__item--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(challenge.id)}
                    onKeyDown={(event) => handleItemKeyDown(event, challenge.id)}
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
                <button type="button" className="song-select__panel-btn" onClick={openListPanel}>
                  목록으로
                </button>
              </div>

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
                selectedChallengeReviews.map((review) => (
                  <article className="song-select__review-card" key={review.id}>
                    <div className="song-select__review-header">
                      <div>
                        <strong>{review.memberDisplayName}</strong>
                        <span>{formatReviewDate(review.updatedAt)}</span>
                      </div>
                      <span className="song-select__review-score">{renderStars(review.rating)}</span>
                    </div>
                    <p className="song-select__review-content">{review.content}</p>
                  </article>
                ))
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
  const numeric = Number(normalized);

  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.min(10, Math.round(numeric)));
  }

  const difficultyMap: Record<string, number> = {
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

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { CameraSetupModal } from '../features/challenges/CameraSetupModal';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { getChallenges } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import type { Challenge } from '../shared/types/challenge';

type ChallengeFilter = 'ALL' | 'READY' | 'REVIEWED';

const AUDIO_FADE_MS = 400;

export function ChallengesPage() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modalChallengeId, setModalChallengeId] = useState<number | null>(null);

  /* ── Audio refs ── */
  const audioRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const selectDebounceRef = useRef<number | null>(null);

  const modalChallenge = useMemo(
    () => (modalChallengeId != null ? challenges.find((c) => c.id === modalChallengeId) ?? null : null),
    [modalChallengeId, challenges],
  );

  useEffect(() => {
    let active = true;

    async function loadChallenges() {
      setLoading(true);
      setError(null);

      try {
        const response = await getChallenges();
        if (active) {
          setChallenges(response);
          if (response.length > 0) {
            setSelectedId(response[0].id);
          }
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
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
      if (selectDebounceRef.current) window.clearTimeout(selectDebounceRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as const, label: 'PLAYABLE', count: challenges.length },
      {
        key: 'READY' as const,
        label: '준비완료',
        count: challenges.filter((c) => c.referenceMotionProfileReady).length,
      },
      {
        key: 'REVIEWED' as const,
        label: '기록있음',
        count: challenges.filter((c) => Boolean(c.latestRetrySummary)).length,
      },
    ],
    [challenges],
  );

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (activeFilter === 'READY') return challenge.referenceMotionProfileReady;
      if (activeFilter === 'REVIEWED') return Boolean(challenge.latestRetrySummary);
      return true;
    });
  }, [activeFilter, challenges]);

  const selectedChallenge = useMemo(
    () => challenges.find((c) => c.id === selectedId) ?? null,
    [selectedId, challenges],
  );

  /* ── Audio fade helpers ── */
  const fadeOutAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el || el.paused) return Promise.resolve();

    return new Promise<void>((resolve) => {
      if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);

      const step = el.volume / (AUDIO_FADE_MS / 30);
      fadeTimerRef.current = window.setInterval(() => {
        if (el.volume - step <= 0) {
          el.volume = 0;
          el.pause();
          if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
          resolve();
        } else {
          el.volume = Math.max(0, el.volume - step);
        }
      }, 30);
    });
  }, []);

  const fadeInAudio = useCallback((src: string) => {
    const el = audioRef.current;
    if (!el) return;

    el.src = src;
    el.volume = 0;
    el.currentTime = 0;

    const playPromise = el.play();
    if (playPromise) {
      playPromise.catch(() => {
        /* Autoplay blocked — user interaction required */
      });
    }

    if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);

    const targetVolume = 0.6;
    const step = targetVolume / (AUDIO_FADE_MS / 30);
    fadeTimerRef.current = window.setInterval(() => {
      if (el.volume + step >= targetVolume) {
        el.volume = targetVolume;
        if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      } else {
        el.volume = Math.min(targetVolume, el.volume + step);
      }
    }, 30);
  }, []);

  /* ── Handle selection with debounce for fast scrolling ── */
  const handleItemClick = useCallback(
    (challengeId: number) => {
      setSelectedId(challengeId);

      /* Debounce audio switch for fast scrolling */
      if (selectDebounceRef.current) window.clearTimeout(selectDebounceRef.current);

      selectDebounceRef.current = window.setTimeout(() => {
        const ch = challenges.find((c) => c.id === challengeId);
        const videoUrl = ch?.guideVideoUrl ?? ch?.fallbackThumbnailVideoUrl ?? null;

        if (videoUrl) {
          void fadeOutAudio().then(() => fadeInAudio(resolveApiUrl(videoUrl)));
        } else {
          void fadeOutAudio();
        }
      }, 200);
    },
    [challenges, fadeOutAudio, fadeInAudio],
  );

  function handleItemKeyDown(event: KeyboardEvent<HTMLElement>, challengeId: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(challengeId);
    }
  }

  /* ── Auto-play first selected ── */
  useEffect(() => {
    if (selectedChallenge && audioRef.current) {
      const videoUrl = selectedChallenge.guideVideoUrl ?? selectedChallenge.fallbackThumbnailVideoUrl ?? null;
      if (videoUrl && audioRef.current.paused) {
        /* Don't auto-play on first load — browsers block it. Wait for user click. */
      }
    }
  }, [selectedChallenge]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 목록을 불러오는 중입니다.</strong>
          <p>공개된 챌린지를 정리해 보여드리고 있습니다.</p>
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

  const previewVideoUrl =
    selectedChallenge?.guideVideoUrl ?? selectedChallenge?.fallbackThumbnailVideoUrl ?? null;
  const resolvedPreviewUrl = previewVideoUrl ? resolveApiUrl(previewVideoUrl) : null;

  return (
    <div className="glass-page">
      {/* Hidden audio element for music preview */}
      <video
        ref={audioRef}
        style={{ display: 'none' }}
        playsInline
        preload="auto"
      />

      <div className="song-select">
        {/* ═══ Left Pane: Video + Title + Actions ═══ */}
        <div className="song-select__detail song-select__detail--video-fill">
          {/* Full-screen video background */}
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

          {/* Gradient overlay for readability */}
          <div className="song-select__detail-gradient" />

          {/* Content overlay: Title + Duration + Button */}
          {selectedChallenge && (
            <div className="song-select__detail-overlay">
              <div className="song-select__detail-content">
                <h2 className="song-select__title song-select__title--overlay">
                  {selectedChallenge.title}
                </h2>
                <p className="song-select__subtitle song-select__subtitle--overlay">
                  {selectedChallenge.category} · {formatDuration(selectedChallenge.durationSec)}
                </p>
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
          )}
        </div>

        {/* ═══ Right Pane: Song List ═══ */}
        <div className="song-select__list-pane">
          {/* Filter tabs */}
          <div className="song-select__filter-bar">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`song-select__filter-tab${activeFilter === option.key ? ' song-select__filter-tab--active' : ''}`}
                onClick={() => setActiveFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Sort info */}
          <div className="song-select__sort-row">
            <span>≡ 정렬: 챌린지 제목 (A to Z)</span>
            <span>총 {filteredChallenges.length}개</span>
          </div>

          {/* Song list */}
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
                  {/* Thumbnail */}
                  <div className="song-select__item-thumb">
                    {challenge.thumbnailUrl ? (
                      <img src={challenge.thumbnailUrl} alt={challenge.title} />
                    ) : challenge.fallbackThumbnailVideoUrl ? (
                      <video src={challenge.fallbackThumbnailVideoUrl} muted playsInline preload="metadata" />
                    ) : (
                      <div className="song-select__item-thumb-placeholder">
                        CH-{String(challenge.id).padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="song-select__item-info">
                    <span className="song-select__item-title">{challenge.title}</span>
                    <span className="song-select__item-sub">
                      {challenge.category} · {challenge.difficulty} · {challenge.durationSec}초
                    </span>
                  </div>

                  {/* Badge */}
                  <span
                    className={`song-select__item-badge ${
                      challenge.referenceMotionProfileReady
                        ? 'song-select__item-badge--ready'
                        : 'song-select__item-badge--pending'
                    }`}
                  >
                    {challenge.referenceMotionProfileReady ? '준비됨' : '대기'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Camera Setup Modal */}
      {modalChallenge && (
        <CameraSetupModal
          challengeTitle={modalChallenge.title}
          onConfirm={() => {
            void fadeOutAudio();
            const targetId = modalChallengeId;
            setModalChallengeId(null);
            void navigate(`/challenges/${targetId}/start`);
          }}
          onClose={() => setModalChallengeId(null)}
        />
      )}
    </div>
  );
}

function formatDuration(durationSec: number) {
  if (durationSec < 60) return `${durationSec}초`;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { buildMotionAnalysisJudgementCue } from '../features/challenges/playJudgement';
import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../shared/api/attemptApi';
import { getChallengeById } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import { useAnimatedNumber } from '../shared/hooks/useAnimatedNumber';
import {
  ATTEMPT_REPLAY_FILTERS,
  filterAttemptReplayCues,
  getAttemptReplayFilterLabel,
  type AttemptReplayFilterKey,
} from '../shared/presentation/attemptReplayFilter';
import { buildAttemptJudgementInsights } from '../shared/presentation/attemptJudgementInsights';
import { buildAttemptReplayHud } from '../shared/presentation/attemptReplayHud';
import { buildAttemptReplayTimeline } from '../shared/presentation/attemptReplayTimeline';
import type { AttemptSummary, AttemptVideoProcessingJobProgress } from '../shared/types/attempt';
import type { Challenge } from '../shared/types/challenge';

export function AttemptResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [currentPlaybackMs, setCurrentPlaybackMs] = useState(0);
  const [replayDurationMs, setReplayDurationMs] = useState<number | null>(null);
  const [replayFilter, setReplayFilter] = useState<AttemptReplayFilterKey>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [selectedCueId, setSelectedCueId] = useState<number | null>(null);
  const attemptReplayVideoRef = useRef<HTMLVideoElement | null>(null);
  const referenceReplayVideoRef = useRef<HTMLVideoElement | null>(null);
  const replayScrubberRef = useRef<HTMLDivElement | null>(null);
  const replayFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    if (!id) {
      setError('시도 ID가 없습니다.');
      setLoading(false);
      return;
    }

    let active = true;

    async function loadAttempt() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttemptById(Number(id));
        if (active) {
          setAttempt(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '시도 결과를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempt();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleRefreshProgress() {
    if (!attempt?.pendingTrackingId) {
      return;
    }

    setProgressLoading(true);
    setProgressMessage(null);

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      await applyProgress(progress);
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : '처리 상태를 새로 불러오지 못했습니다.');
    } finally {
      setProgressLoading(false);
    }
  }

  async function applyProgress(progress: AttemptVideoProcessingJobProgress) {
    if (progress.resultAttemptId && progress.resultAttemptId !== attempt?.id) {
      navigate(`/attempts/${progress.resultAttemptId}/result`, { replace: true });
      return;
    }

    if (attempt) {
      const refreshed = await getAttemptById(attempt.id);
      setAttempt(refreshed);
    }

    setProgressMessage(buildProgressMessage(progress));
  }

  useEffect(() => {
    const challengeId = attempt?.challengeId;

    if (!challengeId) {
      setChallenge(null);
      return;
    }
    const resolvedChallengeId: number = challengeId;

    let active = true;

    async function loadChallenge() {
      try {
        const response = await getChallengeById(resolvedChallengeId);
        if (active) {
          setChallenge(response);
        }
      } catch {
        if (active) {
          setChallenge(null);
        }
      }
    }

    void loadChallenge();

    return () => {
      active = false;
    };
  }, [attempt?.challengeId]);

  const pending = !attempt?.processingComplete || attempt?.processingMode === 'ASYNC_JOB_PENDING';
  const finalFeedback = !pending ? attempt?.finalFeedback ?? null : null;
  const flowModeLabel = attempt ? formatResultSource(attempt.resultSource) : '';
  const scoreDelta = attempt?.scoreDeltaFromPrevious ?? null;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;
  const animatedScore = useAnimatedNumber(attempt?.score ?? 0, { duration: 1650 });
  const animatedRate = useAnimatedNumber(Math.max(0, attempt?.score ?? 0), { duration: 1900, decimals: 2 });
  const resultRate = attempt ? `${animatedRate.toFixed(2)}%` : '0.00%';
  const displayedScore = attempt?.scoreAvailable ? animatedScore : '--';
  const rhythmLabel = finalFeedback?.rhythmLabel || flowModeLabel || '분석 결과';
  const clearStatusLabel = pending ? '대기' : finalFeedback ? (finalFeedback.cleared ? '클리어' : '재도전') : '완료';

  const headline = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return '진행 중';
    }

    return finalFeedback?.headline || attempt.resultHeadline || '결과';
  }, [attempt, finalFeedback, pending]);

  const summary = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return attempt.processingNotice ?? '진행 중';
    }

    return finalFeedback?.summary || attempt.resultSummary;
  }, [attempt, finalFeedback, pending]);

  const briefComment = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return '분석 중';
    }

    if (finalFeedback?.focusLabel) {
      return `Focus: ${finalFeedback.focusLabel}`;
    }

    return attempt.coachingTeaser || attempt.keepStableFocus || attempt.retryFocus || '다음에는 더 좋아질 수 있습니다.';
  }, [attempt, finalFeedback, pending]);

  const replayCues = useMemo(
    () => (attempt ? attempt.judgementTimeline.map((cue) => buildMotionAnalysisJudgementCue(cue)) : []),
    [attempt],
  );
  const judgementInsights = useMemo(
    () => buildAttemptJudgementInsights(attempt?.judgementTimeline ?? []),
    [attempt?.judgementTimeline],
  );
  const highlightCueIds = useMemo(() => new Set(judgementInsights.highlightCueIds), [judgementInsights.highlightCueIds]);
  const filteredReplayCues = useMemo(
    () => filterAttemptReplayCues(replayCues, replayFilter, highlightCueIds),
    [highlightCueIds, replayCues, replayFilter],
  );
  const selectedReplayCue = useMemo(
    () =>
      filteredReplayCues.find((cue) => cue.id === selectedCueId) ??
      replayCues.find((cue) => cue.id === selectedCueId) ??
      filteredReplayCues[0] ??
      replayCues[0] ??
      null,
    [filteredReplayCues, replayCues, selectedCueId],
  );
  const replayHud = useMemo(
    () => buildAttemptReplayHud(selectedReplayCue, attempt ?? { retryFocus: null, keepStableFocus: null, strongestArea: null, weakestArea: null }),
    [attempt, selectedReplayCue],
  );
  const replayTimeline = useMemo(
    () =>
      buildAttemptReplayTimeline(
        filteredReplayCues.map((cue) => ({
          id: cue.id,
          triggerMs: cue.triggerMs,
          windowMs: cue.windowMs,
          tone: cue.tone,
        })),
        currentPlaybackMs,
        replayDurationMs,
      ),
    [currentPlaybackMs, filteredReplayCues, replayDurationMs],
  );

  useEffect(() => {
    setCurrentPlaybackMs(0);
    setReplayDurationMs(null);
    setReplayFilter('all');
    setFilterMenuOpen(false);
    setSelectedCueId(null);
  }, [attempt?.id]);

  useEffect(() => {
    if (filteredReplayCues.length > 0) {
      if (!filteredReplayCues.some((cue) => cue.id === selectedCueId)) {
        setSelectedCueId(filteredReplayCues[0].id);
      }
      return;
    }

    if (replayCues.length > 0 && !replayCues.some((cue) => cue.id === selectedCueId)) {
      setSelectedCueId(replayCues[0].id);
    }
  }, [filteredReplayCues, replayCues, selectedCueId]);

  useEffect(() => {
    if (!selectedReplayCue) {
      return;
    }
    setCurrentPlaybackMs(selectedReplayCue.triggerMs);
  }, [selectedReplayCue]);

  useEffect(() => {
    const challengeDurationMs = challenge?.durationSec ? challenge.durationSec * 1000 : null;
    if (challengeDurationMs != null) {
      setReplayDurationMs(challengeDurationMs);
      return;
    }
    if (replayCues.length === 0) {
      setReplayDurationMs(null);
      return;
    }
    const lastCue = replayCues[replayCues.length - 1];
    setReplayDurationMs(lastCue.triggerMs + lastCue.windowMs + 400);
  }, [challenge?.durationSec, replayCues]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!replayFilterMenuRef.current?.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [filterMenuOpen]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과 불러오는 중</strong>
          <p>점수와 판정을 준비하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과 로드 실패</strong>
          <p>{error ?? '요청한 결과를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link button-link--compact" to="/mypage">
              마이페이지
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="play-result">
      <div className="play-result__left">
        <div className="play-result__mode-label">
          <span>{flowModeLabel}</span>
        </div>

        <h3 className="play-result__judgement-title">결과</h3>

        <div className="play-result__judgement-table">
          <span className="play-result__judgement-label play-result__judgement-label--accent">흐름</span>
          <span className="play-result__judgement-value">{flowModeLabel}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">강점</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.strongestArea)}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">보완점</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.weakestArea)}</span>

          <span className="play-result__judgement-label">상태</span>
          <span className="play-result__judgement-value">{pending ? '진행 중' : '완료'}</span>

          <span className="play-result__judgement-label">변화</span>
          <span className="play-result__judgement-value">{formatDelta(scoreDelta)}</span>
        </div>

        <div className="play-result__summary-card">
          {finalFeedback?.badge ? <span className="play-result__feedback-badge">{finalFeedback.badge}</span> : null}
          <strong>{headline}</strong>
          <p>{summary}</p>
          <span>기록 #{String(attempt.id).padStart(3, '0')}</span>
          {progressMessage ? <p>{progressMessage}</p> : null}
          {attempt.coachingTeaser && !pending ? <p>코칭: {attempt.coachingTeaser}</p> : null}
        </div>

        <div className="play-result__brief-grid">
          <div className="play-result__brief-card play-result__brief-card--accent">
            <span>리듬</span>
            <strong>{rhythmLabel}</strong>
          </div>
          <div className={`play-result__brief-card ${finalFeedback?.cleared ? 'play-result__brief-card--good' : 'play-result__brief-card--warning'}`}>
            <span>판정</span>
            <strong>{clearStatusLabel}</strong>
          </div>
          <div className="play-result__brief-card play-result__brief-card--good">
            <span>강점</span>
            <strong>{formatAreaLabel(attempt.strongestArea)}</strong>
          </div>
          <div className="play-result__brief-card play-result__brief-card--warning">
            <span>약점</span>
            <strong>{formatAreaLabel(attempt.weakestArea)}</strong>
          </div>
        </div>

        <div className="play-result__brief-comment">
          <span>한줄 코멘트</span>
          <strong>{briefComment}</strong>
        </div>

        {!pending && judgementInsights.cards.length > 0 ? (
          <section className="play-result__insight-section" aria-label="구간 인사이트">
            <h4 className="play-result__meta-title">구간 인사이트</h4>
            <div className="play-result__insight-grid">
              {judgementInsights.cards.map((card) => (
                <article
                  key={card.id}
                  className={`play-result__insight-card play-result__insight-card--${card.tone}`}
                >
                  <span className="play-result__insight-label">{card.title}</span>
                  <strong>{card.value}</strong>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!pending && replayCues.length > 0 ? (
          <>
            <section className="play-result__replay-section" aria-label="초당 spot 분석">
              <div className="play-result__replay-header">
                <div>
                  <h4 className="play-result__meta-title">초당 Spot 분석</h4>
                  <p className="play-result__replay-copy">
                    자동 채점 cue를 초 단위로 펼쳐서, 어느 구간이 안정적이었는지 바로 확인할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="play-result__replay-jump-btn"
                  onClick={() => {
                    setReplayFilter('highlights');
                    setFilterMenuOpen(false);
                  }}
                >
                  하이라이트 보기
                </button>
              </div>

              <div className="play-result__filter-row">
                <div ref={replayFilterMenuRef} className="play-result__filter-select">
                  <span>필터</span>
                  <button
                    type="button"
                    className="play-result__filter-select-btn"
                    aria-expanded={filterMenuOpen}
                    onClick={() => setFilterMenuOpen((open) => !open)}
                  >
                    <strong>{getAttemptReplayFilterLabel(replayFilter)}</strong>
                    <span>{filteredReplayCues.length} SPOTS</span>
                  </button>
                  {filterMenuOpen ? (
                    <div className="play-result__filter-select-menu" role="menu">
                      {ATTEMPT_REPLAY_FILTERS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={replayFilter === option.key}
                          className={`play-result__filter-select-item ${
                            replayFilter === option.key ? 'play-result__filter-select-item--active' : ''
                          }`}
                          onClick={() => {
                            setReplayFilter(option.key);
                            setFilterMenuOpen(false);
                          }}
                        >
                          {option.label}
                          <span>{option.key === 'highlights' ? 'TOP' : 'VIEW'}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <span className="play-result__filter-meta">
                  {filteredReplayCues.length} / {replayCues.length} 표시
                </span>
              </div>

              {replayHud ? (
                <div className="play-result__replay-stage">
                  <div className={`play-result__replay-hud play-result__replay-hud--${replayHud.tone}`}>
                    <div className="play-result__replay-hud-head">
                      <span className="play-result__replay-hud-kicker">{replayHud.cueLabel}</span>
                      <strong>{replayHud.headline}</strong>
                      <p>{replayHud.subline}</p>
                    </div>
                    <div className="play-result__replay-hud-chip-row">
                      {replayHud.chips.map((chip) => (
                        <div key={chip.id} className="play-result__replay-hud-chip">
                          <span>{chip.label}</span>
                          <strong>{chip.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="play-result__replay-hud-focus">
                      <span>{replayHud.recommendationTitle}</span>
                      <strong>{replayHud.recommendationBody}</strong>
                    </div>
                  </div>

                  {replayTimeline ? (
                    <div className="play-result__scrub-section">
                      <div className="play-result__scrub-summary">
                        <span>현재 선택</span>
                        <strong>
                          {buildReplayStatusLabel(
                            selectedReplayCue
                              ? {
                                  label: selectedReplayCue.label,
                                  second: selectedReplayCue.second,
                                  offsetMs: selectedReplayCue.offsetMs,
                                }
                              : null,
                          )}
                        </strong>
                        <strong>
                          {formatPlaybackClock(currentPlaybackMs)} / {formatPlaybackClock(replayTimeline.durationMs)}
                        </strong>
                      </div>
                      <div className="play-result__scrub-track" ref={replayScrubberRef}>
                        <div
                          className="play-result__scrub-fill"
                          style={{ width: `${replayTimeline.playheadPercent}%` }}
                        />
                        <div
                          className="play-result__scrub-playhead"
                          style={{ left: `${replayTimeline.playheadPercent}%` }}
                        />
                        {replayTimeline.markers.map((marker) => (
                          <button
                            key={marker.id}
                            type="button"
                            className={`play-result__scrub-marker play-result__scrub-marker--${marker.tone} ${
                              marker.id === selectedReplayCue?.id ? 'play-result__scrub-marker--active' : ''
                            }`}
                            style={{
                              left: `${marker.leftPercent}%`,
                              width: `${marker.widthPercent}%`,
                            }}
                            onClick={() => setSelectedCueId(marker.id)}
                            aria-label={`spot ${marker.id}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="play-result__timeline-section" aria-label="spot 목록">
              <h4 className="play-result__meta-title">Spot 목록</h4>
              {filteredReplayCues.length === 0 ? (
                <div className="play-result__timeline-empty">
                  <strong>선택한 필터에 해당하는 spot이 없습니다.</strong>
                  <p>다른 필터로 전환하면 전체 cue 흐름을 다시 볼 수 있습니다.</p>
                </div>
              ) : (
                <div className="play-result__timeline-list">
                  {filteredReplayCues.map((cue) => {
                    const highlighted = highlightCueIds.has(cue.id);
                    return (
                      <button
                        key={cue.id}
                        type="button"
                        className={`play-result__timeline-card play-result__timeline-card--${cue.tone} ${
                          highlighted ? 'play-result__timeline-card--highlighted' : ''
                        } ${cue.id === selectedReplayCue?.id ? 'play-result__timeline-card--active' : ''}`}
                        onClick={() => setSelectedCueId(cue.id)}
                      >
                        <span className="play-result__timeline-time">
                          {String(cue.second + 1).padStart(2, '0')}초 · {formatOffsetLabel(cue.offsetMs)}
                        </span>
                        <strong>{cue.label}</strong>
                        <span>{cue.guide}</span>
                        <span>확신도 {Math.round(cue.confidence * 100)}% · 콤보 {cue.combo}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      <div className="play-result__right">
        <div className="play-result__stat-ring">
          <div className="play-result__stat-item">
            <span>리듬</span>
            <strong>{rhythmLabel}</strong>
          </div>
          <div className="play-result__stat-item">
            <span>판정</span>
            <strong>{clearStatusLabel}</strong>
          </div>
        </div>

        <div className="play-result__score-circle">
          <span className="play-result__rate">{resultRate}</span>
          <span className="play-result__rate-delta">
            {pending
              ? '진행 중'
              : finalFeedback
                ? finalFeedback.cleared
                  ? '클리어 달성'
                  : '재도전 추천'
              : attempt.resultSource === 'SAMPLE_SCORING_PREVIEW'
                ? '미리보기'
                : '완료'}
          </span>
        </div>

        <div className="play-result__score-block">
          <span className="play-result__score-label">점수</span>
          <span className="play-result__score-number">{displayedScore}</span>
          {scoreDelta != null ? (
            <span className="play-result__score-delta">
              {scoreDelta >= 0 ? '+' : '-'} {Math.abs(scoreDelta)}
            </span>
          ) : null}
        </div>

        {isNewRecord ? <span className="play-result__new-record">신기록</span> : null}

        <div className="play-result__actions">
          {pending ? (
            <button
              type="button"
              className="play-result__action-btn"
              onClick={() => void handleRefreshProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? '갱신 중' : '갱신'}
            </button>
          ) : (
            <Link className="play-result__action-btn" to={`/challenges/${attempt.challengeId}/start`}>
              재도전
            </Link>
          )}
          <Link
            className="play-result__action-btn play-result__action-btn--secondary"
            to={`/challenges?challengeId=${attempt.challengeId}`}
          >
            목록
          </Link>
        </div>
      </div>
    </div>
  );
}

function buildProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  if (progress.status === 'COMPLETED') {
    return '완료';
  }
  if (progress.status === 'FAILED') {
    return '실패';
  }
  if (progress.status === 'PROCESSING') {
    return '진행 중';
  }
  return '대기';
}

function formatAreaLabel(value: string | null) {
  if (!value) {
    return '없음';
  }

  if (value === 'pose shape') {
    return '포즈';
  }
  if (value === 'pose timing') {
    return '타이밍';
  }
  if (value === 'detection quality') {
    return '검출 품질';
  }

  return value;
}

function formatResultSource(value: AttemptSummary['resultSource']) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '자동 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '미리보기';
    case 'PREPARED_FLOW':
      return '준비 흐름';
    default:
      return value;
  }
}

function formatProcessingMode(value: NonNullable<AttemptSummary['processingMode']>) {
  switch (value) {
    case 'SYNC_INLINE':
      return '내부';
    case 'ASYNC_JOB_PENDING':
      return '대기';
    default:
      return value;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDelta(delta: number | null) {
  if (delta == null) {
    return '--';
  }

  if (delta === 0) {
    return '0';
  }

  return `${delta > 0 ? '+' : ''}${delta}`;
}

function formatOffsetLabel(offsetMs: number) {
  if (offsetMs === 0) {
    return '정확';
  }

  return `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
}

function formatPlaybackClock(playbackMs: number) {
  const totalSeconds = Math.max(0, Math.floor(playbackMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildReplayStatusLabel(
  cue: {
    label: string;
    second: number;
    offsetMs: number;
  } | null,
) {
  if (!cue) {
    return '큐 선택';
  }

  return `${cue.label} · ${String(cue.second + 1).padStart(2, '0')}초 · ${formatOffsetLabel(cue.offsetMs)}`;
}

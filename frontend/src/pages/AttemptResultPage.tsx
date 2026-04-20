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
  const [selectedCueId, setSelectedCueId] = useState<number | null>(null);
  const attemptReplayVideoRef = useRef<HTMLVideoElement | null>(null);
  const referenceReplayVideoRef = useRef<HTMLVideoElement | null>(null);
  const replayScrubberRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef(false);

  useEffect(() => {
    if (!id) {
      setError('Attempt id is missing.');
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the attempt result.');
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
      setProgressMessage(loadError instanceof Error ? loadError.message : 'Failed to refresh the processing status.');
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
  const flowModeLabel = attempt ? formatResultSource(attempt.resultSource) : '';
  const scoreDelta = attempt?.scoreDeltaFromPrevious ?? null;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;
  const animatedScore = useAnimatedNumber(attempt?.score ?? 0, { duration: 1650 });
  const animatedRate = useAnimatedNumber(Math.max(0, attempt?.score ?? 0), { duration: 1900, decimals: 2 });
  const resultRate = attempt ? `${animatedRate.toFixed(2)}%` : '0.00%';
  const displayedScore = attempt?.scoreAvailable ? animatedScore : '--';

  const headline = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return 'Result analysis is still running.';
    }

    return attempt.resultHeadline || 'Result Analysis';
  }, [attempt, pending]);

  const summary = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return attempt.processingNotice ?? 'The final analysis is still in progress. Refresh the status in a moment.';
    }

    return attempt.resultSummary;
  }, [attempt, pending]);

  const judgementTimeline = useMemo(
    () => (attempt?.judgementTimeline ?? []).map((cue) => buildMotionAnalysisJudgementCue(cue)),
    [attempt?.judgementTimeline],
  );
  const judgementInsights = useMemo(
    () => buildAttemptJudgementInsights(attempt?.judgementTimeline ?? []),
    [attempt?.judgementTimeline],
  );
  const highlightedCueIds = useMemo(() => new Set(judgementInsights.highlightCueIds), [judgementInsights.highlightCueIds]);
  const filteredJudgementTimeline = useMemo(
    () => filterAttemptReplayCues(judgementTimeline, replayFilter, highlightedCueIds),
    [highlightedCueIds, judgementTimeline, replayFilter],
  );
  const replayVideoUrl = attempt?.attemptVideoUrl ? resolveApiUrl(attempt.attemptVideoUrl) : null;
  const referenceReplayVideoUrl = useMemo(() => {
    const rawUrl = challenge?.fallbackThumbnailVideoUrl ?? challenge?.guideVideoUrl ?? null;
    return rawUrl ? resolveApiUrl(rawUrl) : null;
  }, [challenge?.fallbackThumbnailVideoUrl, challenge?.guideVideoUrl]);
  const activeReplayCueId = useMemo(() => {
    if (judgementTimeline.length === 0) {
      return selectedCueId;
    }

    let closestCueId = selectedCueId;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const cue of judgementTimeline) {
      const distance = Math.abs(cue.triggerMs - currentPlaybackMs);
      const threshold = Math.max(280, cue.windowMs);
      if (distance <= threshold && distance < closestDistance) {
        closestCueId = cue.id;
        closestDistance = distance;
      }
    }

    return closestCueId;
  }, [currentPlaybackMs, judgementTimeline, selectedCueId]);
  const activeReplayCue = useMemo(
    () => judgementTimeline.find((cue) => cue.id === activeReplayCueId) ?? null,
    [activeReplayCueId, judgementTimeline],
  );
  const replayHud = useMemo(
    () =>
      buildAttemptReplayHud(activeReplayCue, {
        retryFocus: attempt?.retryFocus ?? null,
        keepStableFocus: attempt?.keepStableFocus ?? null,
        strongestArea: attempt?.strongestArea ?? null,
        weakestArea: attempt?.weakestArea ?? null,
      }),
    [activeReplayCue, attempt?.keepStableFocus, attempt?.retryFocus, attempt?.strongestArea, attempt?.weakestArea],
  );
  const replayTimeline = useMemo(
    () =>
      buildAttemptReplayTimeline(
        filteredJudgementTimeline.map((cue) => ({
          id: cue.id,
          triggerMs: cue.triggerMs,
          windowMs: cue.windowMs,
          tone: cue.tone,
        })),
        currentPlaybackMs,
        replayDurationMs ?? (challenge?.durationSec != null ? challenge.durationSec * 1000 : null),
      ),
    [challenge?.durationSec, currentPlaybackMs, filteredJudgementTimeline, replayDurationMs],
  );

  useEffect(() => {
    setCurrentPlaybackMs(0);
    setReplayDurationMs(null);
    setReplayFilter('all');
    setSelectedCueId(null);
  }, [attempt?.id]);

  function handleReplayTimeUpdate() {
    const attemptVideo = attemptReplayVideoRef.current;
    const referenceVideo = referenceReplayVideoRef.current;

    if (!attemptVideo) {
      return;
    }

    const attemptTimeMs = Math.round(attemptVideo.currentTime * 1000);
    setCurrentPlaybackMs(attemptTimeMs);

    if (!referenceVideo || syncLockRef.current) {
      return;
    }

    const driftSec = Math.abs(referenceVideo.currentTime - attemptVideo.currentTime);
    if (driftSec < 0.12) {
      return;
    }

    syncLockRef.current = true;
    referenceVideo.currentTime = attemptVideo.currentTime;
    window.setTimeout(() => {
      syncLockRef.current = false;
    }, 0);
  }

  function handleReplayPlay() {
    syncSecondaryReplayVideo((referenceVideo) => referenceVideo.play());
  }

  function handleReplayPause() {
    syncSecondaryReplayVideo((referenceVideo) => {
      referenceVideo.pause();
      return undefined;
    });
  }

  function handleReplaySeeked() {
    const attemptVideo = attemptReplayVideoRef.current;
    if (!attemptVideo) {
      return;
    }

    setCurrentPlaybackMs(Math.round(attemptVideo.currentTime * 1000));
    syncSecondaryReplayVideo((referenceVideo) => {
      referenceVideo.currentTime = attemptVideo.currentTime;
      return undefined;
    });
  }

  function handleReplayRateChange() {
    const attemptVideo = attemptReplayVideoRef.current;
    if (!attemptVideo) {
      return;
    }

    syncSecondaryReplayVideo((referenceVideo) => {
      referenceVideo.playbackRate = attemptVideo.playbackRate;
      return undefined;
    });
  }

  function handleReplayLoadedMetadata() {
    const attemptVideo = attemptReplayVideoRef.current;
    if (!attemptVideo || !Number.isFinite(attemptVideo.duration) || attemptVideo.duration <= 0) {
      return;
    }

    setReplayDurationMs(Math.round(attemptVideo.duration * 1000));
  }

  function syncSecondaryReplayVideo(action: (referenceVideo: HTMLVideoElement) => Promise<void> | void) {
    const referenceVideo = referenceReplayVideoRef.current;
    if (!referenceVideo || syncLockRef.current) {
      return;
    }

    syncLockRef.current = true;
    const result = action(referenceVideo);
    if (result instanceof Promise) {
      void result.catch(() => undefined).finally(() => {
        syncLockRef.current = false;
      });
      return;
    }

    window.setTimeout(() => {
      syncLockRef.current = false;
    }, 0);
  }

  function jumpToCue(cueId: number) {
    const cue = judgementTimeline.find((item) => item.id === cueId);
    if (!cue) {
      return;
    }

    const nextTimeSec = Math.max(0, cue.triggerMs - 180) / 1000;
    setSelectedCueId(cue.id);
    setCurrentPlaybackMs(Math.round(nextTimeSec * 1000));

    const attemptVideo = attemptReplayVideoRef.current;
    if (!attemptVideo) {
      return;
    }

    attemptVideo.currentTime = nextTimeSec;
    syncSecondaryReplayVideo((referenceVideo) => {
      referenceVideo.currentTime = nextTimeSec;
      return undefined;
    });
    void attemptVideo.play().catch(() => {
      // Ignore autoplay restrictions. The seek still helps the user inspect the cue.
    });
  }

  function jumpToPlaybackMs(nextPlaybackMs: number) {
    const boundedMs = Math.max(0, Math.min(nextPlaybackMs, replayTimeline?.durationMs ?? nextPlaybackMs));
    const nextTimeSec = boundedMs / 1000;

    setCurrentPlaybackMs(Math.round(boundedMs));

    const nearestCue = judgementTimeline.reduce(
      (closest, cue) => {
        const distance = Math.abs(cue.triggerMs - boundedMs);
        if (!closest || distance < closest.distance) {
          return { cueId: cue.id, distance };
        }
        return closest;
      },
      null as { cueId: number; distance: number } | null,
    );
    setSelectedCueId(nearestCue?.cueId ?? null);

    const attemptVideo = attemptReplayVideoRef.current;
    if (!attemptVideo) {
      return;
    }

    attemptVideo.currentTime = nextTimeSec;
    syncSecondaryReplayVideo((referenceVideo) => {
      referenceVideo.currentTime = nextTimeSec;
      return undefined;
    });
  }

  function handleReplayScrubberClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!replayTimeline || !replayScrubberRef.current) {
      return;
    }

    const rect = replayScrubberRef.current.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    jumpToPlaybackMs(replayTimeline.durationMs * Math.min(1, Math.max(0, ratio)));
  }

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>Loading result data.</strong>
          <p>The score and analysis details are being prepared.</p>
        </div>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>Unable to load the result.</strong>
          <p>{error ?? 'The requested result could not be found.'}</p>
          <div className="inline-actions">
            <Link className="button-link button-link--compact" to="/mypage">
              Back to My Page
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

        <h3 className="play-result__judgement-title">Result Analysis</h3>

        <div className="play-result__judgement-table">
          <span className="play-result__judgement-label play-result__judgement-label--accent">Flow</span>
          <span className="play-result__judgement-value">{flowModeLabel}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">Strongest</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.strongestArea)}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">Weakest</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.weakestArea)}</span>

          <span className="play-result__judgement-label">Status</span>
          <span className="play-result__judgement-value">{pending ? 'Processing' : 'Completed'}</span>

          <span className="play-result__judgement-label">Delta</span>
          <span className="play-result__judgement-value">{formatDelta(scoreDelta)}</span>
        </div>

        <div className="play-result__summary-card">
          <strong>{headline}</strong>
          <p>{summary}</p>
          <span>Record #{String(attempt.id).padStart(3, '0')}</span>
          {progressMessage ? <p>{progressMessage}</p> : null}
          {attempt.coachingTeaser && !pending ? <p>Coaching: {attempt.coachingTeaser}</p> : null}
        </div>

        {replayVideoUrl && !pending ? (
          <div className="play-result__replay-section">
            <div className="play-result__replay-header">
              <div>
                <h4 className="play-result__meta-title">
                  {referenceReplayVideoUrl ? 'Comparison Replay' : 'Attempt Replay'}
                </h4>
                <p className="play-result__replay-copy">
                  {referenceReplayVideoUrl
                    ? 'The reference video follows the uploaded attempt on the same timeline. Click any judgement card to inspect both at once.'
                    : 'Click any judgement card to jump directly into that moment.'}
                </p>
              </div>
              {judgementTimeline.length > 0 ? (
                <button type="button" className="play-result__replay-jump-btn" onClick={() => jumpToCue(judgementTimeline[0].id)}>
                  Jump to first cue
                </button>
              ) : null}
            </div>

            {judgementTimeline.length > 0 ? (
              <div className="play-result__filter-row">
                <div className="play-result__filter-group" role="tablist" aria-label="Replay filters">
                  {ATTEMPT_REPLAY_FILTERS.map((filterOption) => (
                    <button
                      key={filterOption.key}
                      type="button"
                      role="tab"
                      aria-selected={replayFilter === filterOption.key}
                      className={`play-result__filter-chip ${
                        replayFilter === filterOption.key ? 'play-result__filter-chip--active' : ''
                      }`}
                      onClick={() => setReplayFilter(filterOption.key)}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
                <span className="play-result__filter-meta">
                  {getAttemptReplayFilterLabel(replayFilter)} · {filteredJudgementTimeline.length}/{judgementTimeline.length} cues
                </span>
              </div>
            ) : null}

            <div className="play-result__replay-stage">
              {replayHud ? (
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
              ) : null}

              <div className={`play-result__replay-grid ${referenceReplayVideoUrl ? 'play-result__replay-grid--compare' : ''}`}>
                <div className="play-result__replay-panel">
                  <span className="play-result__replay-panel-label">Attempt</span>
                  <video
                    ref={attemptReplayVideoRef}
                    className="play-result__replay-video"
                    src={replayVideoUrl}
                    controls
                    preload="metadata"
                    onLoadedMetadata={handleReplayLoadedMetadata}
                    onTimeUpdate={handleReplayTimeUpdate}
                    onPlay={handleReplayPlay}
                    onPause={handleReplayPause}
                    onSeeked={handleReplaySeeked}
                    onRateChange={handleReplayRateChange}
                  />
                </div>

                {referenceReplayVideoUrl ? (
                  <div className="play-result__replay-panel">
                    <span className="play-result__replay-panel-label">Reference</span>
                    <video
                      ref={referenceReplayVideoRef}
                      className="play-result__replay-video"
                      src={referenceReplayVideoUrl}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ) : null}
              </div>

              {replayTimeline ? (
                <div className="play-result__scrub-section">
                  <div className="play-result__scrub-summary">
                    <span>Replay timeline</span>
                    <strong>
                      {formatPlaybackClock(currentPlaybackMs)} / {formatPlaybackClock(replayTimeline.durationMs)}
                    </strong>
                  </div>

                  <div
                    ref={replayScrubberRef}
                    className="play-result__scrub-track"
                    onClick={handleReplayScrubberClick}
                    role="slider"
                    aria-label="Replay scrub timeline"
                    aria-valuemin={0}
                    aria-valuemax={replayTimeline.durationMs}
                    aria-valuenow={currentPlaybackMs}
                  >
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
                          activeReplayCueId === marker.id ? 'play-result__scrub-marker--active' : ''
                        }`}
                        style={{
                          left: `${marker.leftPercent}%`,
                          width: `${marker.widthPercent}%`,
                        }}
                        aria-label={`Scrub to cue ${marker.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          jumpToCue(marker.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="play-result__replay-status">
                <span>Now playing {formatPlaybackClock(currentPlaybackMs)}</span>
                <strong>
                  {activeReplayCueId != null
                    ? buildReplayStatusLabel(judgementTimeline.find((cue) => cue.id === activeReplayCueId) ?? null)
                    : 'Pick a cue to inspect a scoring moment.'}
                </strong>
              </div>
            </div>
          </div>
        ) : null}

        {judgementInsights.cards.length > 0 && !pending ? (
          <div className="play-result__insight-section">
            <h4 className="play-result__meta-title">Judgement Insights</h4>
            <div className="play-result__insight-grid">
              {judgementInsights.cards.map((card) => (
                <article key={card.id} className={`play-result__insight-card play-result__insight-card--${card.tone}`}>
                  <span className="play-result__insight-label">{card.title}</span>
                  <strong>{card.value}</strong>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {judgementTimeline.length > 0 && !pending ? (
          <div className="play-result__timeline-section">
            <h4 className="play-result__meta-title">Judgement Replay</h4>
            {filteredJudgementTimeline.length > 0 ? (
              <div className="play-result__timeline-list">
                {filteredJudgementTimeline.map((cue) => (
                  <button
                    type="button"
                    key={cue.id}
                    aria-label={`Jump to cue ${cue.id} at ${String(cue.second + 1).padStart(2, '0')} seconds`}
                    className={[
                      'play-result__timeline-card',
                      `play-result__timeline-card--${cue.tone}`,
                      highlightedCueIds.has(cue.id) ? 'play-result__timeline-card--highlighted' : '',
                      activeReplayCueId === cue.id ? 'play-result__timeline-card--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => jumpToCue(cue.id)}
                  >
                    <span className="play-result__timeline-time">{String(cue.second + 1).padStart(2, '0')} SEC</span>
                    <strong>{cue.label}</strong>
                    <span>{cue.guide}</span>
                    <span>{cue.combo > 0 ? `${cue.combo} COMBO` : 'RESET'} / {formatOffsetLabel(cue.offsetMs)}</span>
                    <span>Confidence {Math.round(cue.confidence * 100)}%</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="play-result__timeline-empty">
                <strong>No cues in this filter.</strong>
                <p>Try a different filter to inspect another timing pattern.</p>
              </div>
            )}
          </div>
        ) : null}

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">Challenge</h4>
          <span className="play-result__meta-value">{attempt.challengeTitle}</span>
        </div>

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">Attempted At</h4>
          <span className="play-result__meta-value">{formatDate(attempt.attemptedAt)}</span>
        </div>

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">Processing</h4>
          <span className="play-result__meta-value">
            {attempt.processingMode ? formatProcessingMode(attempt.processingMode) : 'Inline'}
          </span>
        </div>
      </div>

      <div className="play-result__right">
        <div className="play-result__stat-ring">
          <div className="play-result__stat-item">
            <span>Flow</span>
            <strong>{flowModeLabel}</strong>
          </div>
          <div className="play-result__stat-item">
            <span>Status</span>
            <strong>{pending ? 'Pending' : 'Done'}</strong>
          </div>
        </div>

        <div className="play-result__score-circle">
          <span className="play-result__rate">{resultRate}</span>
          <span className="play-result__rate-delta">
            {pending
              ? 'Analysis in progress'
              : attempt.resultSource === 'SAMPLE_SCORING_PREVIEW'
                ? 'Preview result'
                : 'Motion analysis complete'}
          </span>
        </div>

        <div className="play-result__score-block">
          <span className="play-result__score-label">Score</span>
          <span className="play-result__score-number">{displayedScore}</span>
          {scoreDelta != null ? (
            <span className="play-result__score-delta">
              {scoreDelta >= 0 ? '+' : '-'} {Math.abs(scoreDelta)}
            </span>
          ) : null}
        </div>

        {isNewRecord ? <span className="play-result__new-record">New record</span> : null}

        <div className="play-result__actions">
          {pending ? (
            <button
              type="button"
              className="play-result__action-btn"
              onClick={() => void handleRefreshProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? 'Refreshing...' : 'Refresh status'}
            </button>
          ) : (
            <Link className="play-result__action-btn" to={`/challenges/${attempt.challengeId}/start`}>
              Retry challenge
            </Link>
          )}
          <Link
            className="play-result__action-btn play-result__action-btn--secondary"
            to={`/challenges?challengeId=${attempt.challengeId}`}
          >
            Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}

function buildProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  if (progress.status === 'COMPLETED') {
    return 'Processing is complete. The latest result has been reloaded.';
  }
  if (progress.status === 'FAILED') {
    return 'Processing failed. Try the upload again after checking the environment.';
  }
  if (progress.status === 'PROCESSING') {
    return 'Motion analysis is still running.';
  }
  return 'The upload is waiting in the processing queue.';
}

function formatAreaLabel(value: string | null) {
  if (!value) {
    return 'None';
  }

  if (value === 'pose shape') {
    return 'Pose shape';
  }
  if (value === 'pose timing') {
    return 'Pose timing';
  }
  if (value === 'detection quality') {
    return 'Detection quality';
  }

  return value;
}

function formatResultSource(value: AttemptSummary['resultSource']) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return 'Video autoscore';
    case 'SAMPLE_SCORING_PREVIEW':
      return 'Preview mode';
    case 'PREPARED_FLOW':
      return 'Prepared flow';
    default:
      return value;
  }
}

function formatProcessingMode(value: NonNullable<AttemptSummary['processingMode']>) {
  switch (value) {
    case 'SYNC_INLINE':
      return 'Inline sync';
    case 'ASYNC_JOB_PENDING':
      return 'Async pending';
    default:
      return value;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'No timestamp';
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
    return 'ON TIME';
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
    return 'Pick a cue to inspect a scoring moment.';
  }

  return `${cue.label} around ${String(cue.second + 1).padStart(2, '0')} sec · ${formatOffsetLabel(cue.offsetMs)}`;
}

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import { buildAttemptBreakdownMetrics, buildAttemptBreakdownSummary } from '../../shared/presentation/attemptBreakdown';
import { buildAttemptCoachingTeaser } from '../../shared/presentation/attemptCoaching';
import {
  buildDurableProgressCompletionLinkLabel,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRefreshMessage,
  buildDurableProgressRetryWindowLabel,
} from '../../shared/presentation/durableProgress';
import type {
  AttemptProcessingMode,
  AttemptResultSource,
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
} from '../../shared/types/attempt';

type AttemptHistoryListProps = {
  attempts: AttemptSummary[];
  comparisonDeltaByAttemptId?: Record<number, number>;
  onArchiveRefreshRequested?: () => Promise<void>;
};

export function AttemptHistoryList({
  attempts,
  comparisonDeltaByAttemptId = {},
  onArchiveRefreshRequested,
}: AttemptHistoryListProps) {
  const [progressByAttemptId, setProgressByAttemptId] = useState<Record<number, AttemptVideoProcessingJobProgress | null>>({});
  const [progressMessageByAttemptId, setProgressMessageByAttemptId] = useState<Record<number, string | null>>({});
  const [loadingAttemptId, setLoadingAttemptId] = useState<number | null>(null);

  async function reloadDurableProgress(attempt: AttemptSummary) {
    if (!attempt.pendingTrackingId) {
      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: 'No tracking id is available for this attempt yet.',
      }));
      return;
    }

    setLoadingAttemptId(attempt.id);
    setProgressMessageByAttemptId((current) => ({ ...current, [attempt.id]: null }));

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      setProgressByAttemptId((current) => ({ ...current, [attempt.id]: progress }));

      let nextMessage = buildDurableProgressRefreshMessage(progress, {
        sourceLabel: 'Tracking id lookup',
      });

      if (
        onArchiveRefreshRequested &&
        (progress.status === 'COMPLETED' || progress.status === 'FAILED')
      ) {
        try {
          await onArchiveRefreshRequested();
          nextMessage =
            progress.status === 'COMPLETED'
              ? `${nextMessage} Archive refreshed with the latest result state.`
              : `${nextMessage} Archive refreshed with the latest failure state.`;
        } catch (refreshError) {
          const refreshMessage =
            refreshError instanceof Error ? refreshError.message : 'Archive refresh failed after the progress check.';
          nextMessage = `${nextMessage} ${refreshMessage}`;
        }
      }

      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: nextMessage,
      }));
    } catch (error) {
      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: error instanceof Error ? error.message : 'Failed to reload durable progress.',
      }));
    } finally {
      setLoadingAttemptId(null);
    }
  }

  return (
    <div className="grid grid--archive">
      {attempts.map((attempt) => {
        const statusMeta = buildHistoryStatusMeta(attempt.status);
        const sourceMeta = buildHistorySourceMeta(attempt.resultSource);
        const scoreMeta = buildHistoryScoreMeta(attempt.scoreAvailable);
        const processingModeMeta = buildProcessingModeMeta(attempt.processingMode);
        const processingCompleteMeta = buildProcessingCompleteMeta(attempt.processingComplete);
        const pendingProcessWarning = !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';
        const currentStage = buildCurrentStageSummary(attempt);
        const breakdownSummary = buildAttemptBreakdownSummary(attempt);
        const breakdownMetrics = buildAttemptBreakdownMetrics(attempt);
        const coachingTeaser = buildAttemptCoachingTeaser(attempt);
        const progress = progressByAttemptId[attempt.id] ?? null;
        const progressMessage = progressMessageByAttemptId[attempt.id] ?? null;
        const completedResultId = progress?.resultAttemptId ?? null;
        const comparisonDelta = comparisonDeltaByAttemptId[attempt.id] ?? null;

        return (
          <article className="panel panel--section archive-card panel-lift" key={attempt.id}>
            <div className="archive-card__header">
              <div>
                <span className="hero__eyebrow">ATT-{String(attempt.id).padStart(3, '0')}</span>
                <h3>{attempt.challengeTitle}</h3>
                <p>{formatAttemptState(attempt.status, attempt.processingMode, attempt.processingComplete)}</p>
              </div>
              <div className="archive-card__score">
                <span>SCORE</span>
                <strong>{attempt.score}</strong>
                {comparisonDelta != null && attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED' ? (
                  <small
                    className={`archive-card__delta ${comparisonDelta >= 0 ? 'archive-card__delta--good' : 'archive-card__delta--warn'}`}
                  >
                    {comparisonDelta >= 0 ? `+${comparisonDelta}` : comparisonDelta} vs prev
                  </small>
                ) : null}
              </div>
            </div>

            <div className="archive-card__meta archive-card__meta--status">
              <span className={`pill pill--${statusMeta.tone}`}>
                <StatusGlyph kind={statusMeta.icon} tone={statusMeta.tone} />
                {statusMeta.label}
              </span>
              <span className={`pill pill--${scoreMeta.tone}`}>
                <StatusGlyph kind={scoreMeta.icon} tone={scoreMeta.tone} />
                {scoreMeta.label}
              </span>
              <span className={`pill pill--${sourceMeta.tone}`}>
                <StatusGlyph kind={sourceMeta.icon} tone={sourceMeta.tone} />
                {sourceMeta.label}
              </span>
              <span className={`pill pill--${processingModeMeta.tone}`}>
                <StatusGlyph kind={processingModeMeta.icon} tone={processingModeMeta.tone} />
                {processingModeMeta.label}
              </span>
              <span className={`pill pill--${processingCompleteMeta.tone}`}>
                <StatusGlyph kind={processingCompleteMeta.icon} tone={processingCompleteMeta.tone} />
                {processingCompleteMeta.label}
              </span>
              <span className="pill">
                <StatusGlyph kind="SAVE" tone="neutral" />
                CH-{String(attempt.challengeId).padStart(2, '0')}
              </span>
            </div>

            <div className="archive-card__banner panel-lift panel-lift--accent">
              <strong>{attempt.resultHeadline}</strong>
              <p>{attempt.resultSummary}</p>
              {attempt.processingNotice ? <p>{attempt.processingNotice}</p> : null}
              {breakdownSummary ? <p className="archive-card__breakdown-summary">{breakdownSummary}</p> : null}
              {breakdownMetrics.length > 0 ? (
                <div className="archive-card__breakdown-metrics">
                  {breakdownMetrics.map((metric) => (
                    <span key={metric.label}>{metric.label} {metric.value}</span>
                  ))}
                </div>
              ) : null}
              {coachingTeaser ? <p className="archive-card__coaching">{coachingTeaser}</p> : null}
              {attempt.retryFocus ? <p className="archive-card__focus"><strong>Retry focus</strong>{attempt.retryFocus}</p> : null}
              {attempt.keepStableFocus ? <p className="archive-card__focus archive-card__focus--stable"><strong>Keep stable</strong>{attempt.keepStableFocus}</p> : null}
            </div>

            <div className="archive-card__stage">
              <strong>Current stage</strong>
              <p>{currentStage}</p>
            </div>

            {pendingProcessWarning ? (
              <div className="archive-warning-feed">
                <strong>Processing follow-up</strong>
                <p>
                  {attempt.processingNotice ??
                    'This attempt still needs a processing check. Refresh durable progress and continue when the result is ready.'}
                </p>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void reloadDurableProgress(attempt)}
                    disabled={loadingAttemptId === attempt.id}
                  >
                    {loadingAttemptId === attempt.id ? 'Refreshing...' : 'Refresh durable progress'}
                  </button>
                  {completedResultId ? (
                    <Link className="button-link" to={`/attempts/${completedResultId}/result`}>
                      {buildDurableProgressCompletionLinkLabel()}
                    </Link>
                  ) : null}
                </div>
                {progressMessage ? <p>{progressMessage}</p> : null}
                {progress ? (
                  <dl className="archive-card__progress-meta">
                    <div>
                      <dt>Completion strategy</dt>
                      <dd>{buildDurableProgressCompletionStrategyLabel(progress.completionStrategy)}</dd>
                    </div>
                    <div>
                      <dt>Elapsed</dt>
                      <dd>{buildDurableProgressElapsedTimeLabel(progress.elapsedSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Auto retry</dt>
                      <dd>{buildDurableProgressRetryWindowLabel(progress)}</dd>
                    </div>
                    <div>
                      <dt>Original file</dt>
                      <dd>{buildDurableProgressOriginalFileLabel(progress)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}

            <div className="archive-card__footer">
              <p>Created at {new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
              <div className="inline-actions">
                <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                  Open result
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
                  Open challenge
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}/start`}>
                  Retry challenge
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatAttemptState(
  status: AttemptSummary['status'],
  processingMode: AttemptProcessingMode | null,
  processingComplete: boolean,
): string {
  if (status === 'Prepared') {
    return 'Prepared only. Upload a real video to start analysis and scoring.';
  }

  if (processingMode === 'ASYNC_JOB_PENDING' && !processingComplete) {
    return 'Async processing is still running. Refresh durable progress to continue.';
  }

  return 'This attempt already has a saved result.';
}

function buildCurrentStageSummary(attempt: AttemptSummary): string {
  if (attempt.status === 'Prepared') {
    return 'The attempt is saved in prepared state and has not been compared yet.';
  }

  if (attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete) {
    return 'The upload is waiting for async completion. Use the tracking id progress tools to monitor it.';
  }

  if (attempt.processingMode === 'SYNC_INLINE' && attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'The upload was processed inline and the scoring result is ready.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return 'This is a saved preview result, not a real upload comparison.';
  }

  return 'The result is ready to review.';
}

function buildHistoryStatusMeta(status: AttemptSummary['status']) {
  if (status === 'Prepared') {
    return { tone: 'neutral' as const, icon: 'RDY', label: 'Prepared' };
  }
  return { tone: 'good' as const, icon: 'CLR', label: 'Completed' };
}

function buildHistoryScoreMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return { tone: 'good' as const, icon: 'PTS', label: 'Score ready' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: 'Score pending' };
}

function buildHistorySourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return { tone: 'good' as const, icon: 'LIVE', label: 'Auto-scored upload' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { tone: 'warn' as const, icon: 'SAMP', label: 'Sample preview' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: 'Prepared flow' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null) {
  switch (mode) {
    case 'SYNC_INLINE':
      return { tone: 'good' as const, icon: 'LIVE', label: 'Inline processing' };
    case 'ASYNC_JOB_PENDING':
      return { tone: 'warn' as const, icon: 'WAIT', label: 'Async pending' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: 'Default flow' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean) {
  if (processingComplete) {
    return { tone: 'good' as const, icon: 'CLR', label: 'Completed' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: 'Needs review' };
}

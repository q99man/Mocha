import { useState } from 'react';
import { Link } from 'react-router-dom';

import { getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import { buildAttemptBreakdownMetrics, buildAttemptBreakdownSummary } from '../../shared/presentation/attemptBreakdown';
import { buildAttemptCoachingTeaser } from '../../shared/presentation/attemptCoaching';
import {
  buildDurableProgressCalloutTitle,
  buildDurableProgressCompletionLinkLabel,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressNextStep,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRefreshMessage,
  buildDurableProgressRetryWindowLabel,
  buildDurableProgressSummary,
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
        [attempt.id]: '아직 이 시도에 연결된 추적 ID가 없습니다.',
      }));
      return;
    }

    setLoadingAttemptId(attempt.id);
    setProgressMessageByAttemptId((current) => ({ ...current, [attempt.id]: null }));

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      setProgressByAttemptId((current) => ({ ...current, [attempt.id]: progress }));

      let nextMessage = buildDurableProgressRefreshMessage(progress, {
        sourceLabel: '추적 ID 조회',
      });

      if (
        onArchiveRefreshRequested &&
        (progress.status === 'COMPLETED' || progress.status === 'FAILED')
      ) {
        try {
          await onArchiveRefreshRequested();
          nextMessage =
            progress.status === 'COMPLETED'
              ? `${nextMessage} 아카이브도 최신 결과 상태로 갱신했습니다.`
              : `${nextMessage} 아카이브도 최신 실패 상태로 갱신했습니다.`;
        } catch (refreshError) {
          const refreshMessage =
            refreshError instanceof Error ? refreshError.message : '진행 상태 확인 후 아카이브 새로고침에 실패했습니다.';
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
        [attempt.id]: error instanceof Error ? error.message : '내구 진행 상태를 다시 불러오지 못했습니다.',
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
                <span>점수</span>
                <strong>{attempt.score}</strong>
                {comparisonDelta != null && attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED' ? (
                  <small
                    className={`archive-card__delta ${comparisonDelta >= 0 ? 'archive-card__delta--good' : 'archive-card__delta--warn'}`}
                  >
                    {comparisonDelta >= 0 ? `+${comparisonDelta}` : comparisonDelta} 이전 대비
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
              <span className="pill">
                <StatusGlyph kind="USR" tone="neutral" />
                {attempt.memberDisplayName}
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
              {attempt.retryFocus ? <p className="archive-card__focus"><strong>다음 재도전 포인트</strong>{attempt.retryFocus}</p> : null}
              {attempt.keepStableFocus ? <p className="archive-card__focus archive-card__focus--stable"><strong>유지할 강점</strong>{attempt.keepStableFocus}</p> : null}
            </div>

            <div className="archive-card__stage">
              <strong>현재 단계</strong>
              <p>{currentStage}</p>
            </div>

            {pendingProcessWarning ? (
              <div className="archive-warning-feed">
                <strong>{buildArchiveCalloutTitle(progress)}</strong>
                <p>
                  {progress
                    ? buildDurableProgressSummary(progress)
                    : attempt.processingNotice ??
                      '이 시도는 아직 추가 처리 확인이 필요합니다. 진행 상태를 새로고침한 뒤 결과가 준비되면 이어서 확인해 주세요.'}
                </p>
                {progress ? <p>{buildDurableProgressNextStep(progress)}</p> : null}
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void reloadDurableProgress(attempt)}
                    disabled={loadingAttemptId === attempt.id}
                  >
                    {loadingAttemptId === attempt.id ? '새로고침 중...' : '진행 상태 새로고침'}
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
                      <dt>완료 방식</dt>
                      <dd>{buildDurableProgressCompletionStrategyLabel(progress.completionStrategy)}</dd>
                    </div>
                    <div>
                      <dt>경과 시간</dt>
                      <dd>{buildDurableProgressElapsedTimeLabel(progress.elapsedSeconds)}</dd>
                    </div>
                    <div>
                      <dt>자동 재시도</dt>
                      <dd>{buildDurableProgressRetryWindowLabel(progress)}</dd>
                    </div>
                    <div>
                      <dt>원본 파일</dt>
                      <dd>{buildDurableProgressOriginalFileLabel(progress)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}

            <div className="archive-card__footer">
              <div className="archive-card__owner">
                <p>{attempt.memberDisplayName}</p>
                <span>{attempt.memberEmail}</span>
              </div>
              <p>생성 시각 {new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
              <div className="inline-actions">
                <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                  결과 보기
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges?challengeId=${attempt.challengeId}`}>
                  챌린지 보기
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}/start`}>
                  다시 도전하기
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
    return '준비 상태로만 저장되어 있습니다. 실제 영상을 올리면 분석과 채점이 시작됩니다.';
  }

  if (processingMode === 'ASYNC_JOB_PENDING' && !processingComplete) {
    return '비동기 처리가 아직 진행 중입니다. 진행 상태를 새로고침해 이어서 확인해 주세요.';
  }

  return '이 시도는 이미 결과가 저장되어 있습니다.';
}

function buildCurrentStageSummary(attempt: AttemptSummary): string {
  if (attempt.status === 'Prepared') {
    return '시도가 준비 상태로 저장되어 있으며 아직 비교 분석은 시작되지 않았습니다.';
  }

  if (attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete) {
    return '업로드가 비동기 완료를 기다리는 중입니다. 추적 ID 진행 상태로 계속 확인할 수 있습니다.';
  }

  if (attempt.processingMode === 'SYNC_INLINE' && attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '업로드가 즉시 처리되었고 채점 결과도 준비되었습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '실제 업로드 비교가 아니라 저장된 미리보기 결과입니다.';
  }

  return '결과를 바로 검토할 수 있는 상태입니다.';
}

function buildArchiveCalloutTitle(progress: AttemptVideoProcessingJobProgress | null) {
  return buildDurableProgressCalloutTitle(progress);
}

function buildHistoryStatusMeta(status: AttemptSummary['status']) {
  if (status === 'Prepared') {
    return { tone: 'neutral' as const, icon: 'RDY', label: '준비됨' };
  }
  return { tone: 'good' as const, icon: 'CLR', label: '완료됨' };
}

function buildHistoryScoreMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return { tone: 'good' as const, icon: 'PTS', label: '점수 준비됨' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: '점수 대기 중' };
}

function buildHistorySourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return { tone: 'good' as const, icon: 'LIVE', label: '자동 채점 업로드' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { tone: 'warn' as const, icon: 'SAMP', label: '샘플 미리보기' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: '준비 흐름' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null) {
  switch (mode) {
    case 'SYNC_INLINE':
      return { tone: 'good' as const, icon: 'LIVE', label: '즉시 처리' };
    case 'ASYNC_JOB_PENDING':
      return { tone: 'warn' as const, icon: 'WAIT', label: '비동기 대기 중' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: '기본 흐름' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean) {
  if (processingComplete) {
    return { tone: 'good' as const, icon: 'CLR', label: '처리 완료' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: '확인 필요' };
}

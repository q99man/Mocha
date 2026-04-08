import { useState } from 'react';
import { Link } from 'react-router-dom';

import { getAttemptVideoProcessingProgressByTrackingId } from '../../shared/api/attemptApi';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import type {
  AttemptProcessingMode,
  AttemptResultSource,
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
} from '../../shared/types/attempt';
import { buildDurableProgressCompletionLinkDescription, buildDurableProgressCompletionLinkLabel, buildDurableProgressCompletionStrategyLabel, buildDurableProgressElapsedTimeLabel, buildDurableProgressFailureAction, buildDurableProgressHeadline, buildDurableProgressOriginalFileLabel, buildDurableProgressRefreshMessage, buildDurableProgressRetryWindowLabel, buildDurableProgressSnapshotFromAttempt, buildDurableProgressSummary } from '../../shared/presentation/durableProgress';

type AttemptHistoryListProps = {
  attempts: AttemptSummary[];
};

export function AttemptHistoryList({ attempts }: AttemptHistoryListProps) {
  const [progressByAttemptId, setProgressByAttemptId] = useState<Record<number, AttemptVideoProcessingJobProgress | null>>({});
  const [progressMessageByAttemptId, setProgressMessageByAttemptId] = useState<Record<number, string | null>>({});
  const [loadingAttemptId, setLoadingAttemptId] = useState<number | null>(null);

  async function reloadDurableProgress(attempt: AttemptSummary) {
    if (!attempt.pendingTrackingId) {
      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: '다시 조회할 trackingId가 아직 없습니다.',
      }));
      return;
    }

    setLoadingAttemptId(attempt.id);
    setProgressMessageByAttemptId((current) => ({ ...current, [attempt.id]: null }));

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      setProgressByAttemptId((current) => ({ ...current, [attempt.id]: progress }));
      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: buildDurableProgressRefreshMessage(progress, {
          sourceLabel: 'trackingId direct progress',
        }),
      }));
    } catch (error) {
      setProgressMessageByAttemptId((current) => ({
        ...current,
        [attempt.id]: error instanceof Error ? error.message : 'durable progress 상태를 다시 확인하지 못했습니다.',
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
        const progress = progressByAttemptId[attempt.id] ?? null;
        const progressMessage = progressMessageByAttemptId[attempt.id] ?? null;
        const completedResultId = progress?.resultAttemptId ?? null;

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
            </div>

            <div className="archive-card__stage">
              <strong>현재 단계</strong>
              <p>{currentStage}</p>
            </div>

            {pendingProcessWarning ? (
              <div className="archive-warning-feed">
                <strong>처리 확인 필요</strong>
                <p>
                  {attempt.processingNotice ??
                    '이 기록은 아직 처리 대기 중이거나 후속 확인이 필요한 상태입니다. 상태를 다시 확인한 뒤 이어서 진행해 주세요.'}
                </p>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void reloadDurableProgress(attempt)}
                    disabled={loadingAttemptId === attempt.id}
                  >
                    {loadingAttemptId === attempt.id ? '상태 다시 확인 중...' : 'durable progress 다시 확인'}
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
                      <dt>?쒕퉬 泥섎━ ?쒓컖</dt>
                      <dd>{buildDurableProgressElapsedTimeLabel(progress.elapsedSeconds)}</dd>
                    </div>
                    <div>
                      <dt>?꾨줈?좏???대튂???</dt>
                      <dd>{buildDurableProgressRetryWindowLabel(progress)}</dd>
                    </div>
                    <div>
                      <dt>?낅줈???뚯씪</dt>
                      <dd>{buildDurableProgressOriginalFileLabel(progress)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}

            <div className="archive-card__footer">
              <p>저장 시각 {new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
              <div className="inline-actions">
                <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                  결과 화면 보기
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
                  챌린지 보기
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
  if (status === '준비됨') {
    return '준비 단계까지만 저장한 기록입니다. 시작 화면에서 보던 준비 흐름을 여기서 다시 확인할 수 있습니다.';
  }

  if (processingMode === 'ASYNC_JOB_PENDING' && !processingComplete) {
    return '비동기 대기 중인 기록입니다. 상태를 다시 확인한 뒤 다음 단계를 이어서 진행해 주세요.';
  }

  return '완료된 결과 기록입니다. 시작 화면과 결과 화면에서 이어지던 흐름을 여기서 다시 확인할 수 있습니다.';
}

function buildCurrentStageSummary(attempt: AttemptSummary): string {
  if (attempt.status === '준비됨') {
    return '준비 상태만 저장된 단계입니다. 업로드나 자동 채점 전 확인 기록으로 이어서 볼 수 있습니다.';
  }

  if (attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete) {
    return '업로드는 접수되었고 durable progress 기준으로 후속 처리를 기다리는 상태입니다. trackingId 재조회나 로컬 완료 처리로 이어서 진행할 수 있습니다.';
  }

  if (attempt.processingMode === 'SYNC_INLINE' && attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '실제 업로드 영상이 자동 채점까지 이어진 상태입니다. 결과 화면에서 바로 이어서 비교하고 확인할 수 있습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '샘플 preview 결과를 저장한 단계입니다. 실제 자동 채점 결과와 구분해서 이어서 비교할 수 있습니다.';
  }

  return '결과가 완료된 상태입니다. 결과 화면에서 바로 이어서 확인할 수 있습니다.';
}

function buildHistoryStatusMeta(status: AttemptSummary['status']) {
  if (status === '준비됨') {
    return { tone: 'neutral' as const, icon: 'RDY', label: '준비 상태' };
  }
  return { tone: 'good' as const, icon: 'CLR', label: '완료 결과' };
}

function buildHistoryScoreMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return { tone: 'good' as const, icon: 'PTS', label: '점수 확인 가능' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: '점수 준비 전' };
}

function buildHistorySourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return { tone: 'good' as const, icon: 'LIVE', label: '실제 자동 채점' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { tone: 'warn' as const, icon: 'SAMP', label: '샘플 preview' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: '준비 저장' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null) {
  switch (mode) {
    case 'SYNC_INLINE':
      return { tone: 'good' as const, icon: 'LIVE', label: '동기 처리' };
    case 'ASYNC_JOB_PENDING':
      return { tone: 'warn' as const, icon: 'WAIT', label: '비동기 대기' };
    default:
      return { tone: 'neutral' as const, icon: 'SAVE', label: '프로토타입 저장' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean) {
  if (processingComplete) {
    return { tone: 'good' as const, icon: 'CLR', label: '처리 완료' };
  }
  return { tone: 'warn' as const, icon: 'WAIT', label: '처리 확인 필요' };
}

function buildArchiveProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  switch (progress.status) {
    case 'PENDING':
      return 'durable progress 기준으로 아직 처리 대기 중입니다. 잠시 후 상태를 다시 확인해 주세요.';
    case 'PROCESSING':
      return 'durable progress 기준으로 분석과 채점이 진행 중입니다. 잠시 후 상태를 다시 확인해 주세요.';
    case 'COMPLETED':
      return progress.resultAttemptId
        ? `durable progress 기준으로 처리 완료를 확인했습니다. 완료 결과 #${progress.resultAttemptId}로 바로 이동할 수 있습니다.`
        : 'durable progress 기준으로 처리 완료를 확인했습니다.';
    case 'FAILED':
      return progress.processingNotice ?? 'durable progress 기준으로 실패 상태를 확인했습니다. 안내 문구를 다시 확인해 주세요.';
    default:
      return 'durable progress 상태를 다시 확인했습니다.';
  }
}
function buildArchiveDurableProgressCardToneClass(progress: AttemptVideoProcessingJobProgress) {
  switch (progress.status) {
    case 'PENDING':
      return 'durable-progress-card--pending';
    case 'PROCESSING':
      return 'durable-progress-card--processing';
    case 'COMPLETED':
      return 'durable-progress-card--completed';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH'
        ? 'durable-progress-card--failed-high'
        : 'durable-progress-card--failed-warn';
    default:
      return '';
  }
}

function archiveFailureActionLabel(action: AttemptVideoProcessingJobProgress['failureAction']) {
  switch (action) {
    case 'RETRY_UPLOAD':
      return '영상을 다시 업로드한 뒤 이어서 진행해 주세요.';
    case 'CHECK_STORAGE':
      return '업로드 파일 저장 상태를 다시 확인해 주세요.';
    case 'RETRY_ANALYSIS':
      return '분석을 다시 시도한 뒤 상태를 확인해 주세요.';
    case 'RETRY_SCORING':
      return '채점을 다시 시도한 뒤 상태를 확인해 주세요.';
    default:
      return '안내 문구를 확인한 뒤 이어서 진행해 주세요.';
  }
}
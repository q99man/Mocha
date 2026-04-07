import { Link } from 'react-router-dom';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import type {
  AttemptProcessingMode,
  AttemptResultSource,
  AttemptSummary,
} from '../../shared/types/attempt';

type AttemptHistoryListProps = {
  attempts: AttemptSummary[];
};

export function AttemptHistoryList({ attempts }: AttemptHistoryListProps) {
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
                <p>{attempt.processingNotice ?? '이 기록은 아직 처리 대기 중이거나 후속 확인이 필요한 상태입니다.'}</p>
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
    return '준비 단계에서 저장된 기록입니다. 아직 실제 업로드 자동 채점은 진행되지 않았습니다.';
  }

  if (processingMode === 'ASYNC_JOB_PENDING' && !processingComplete) {
    return '비동기 대기 중인 업로드 기록입니다. 후속 완료 단계가 아직 남아 있습니다.';
  }

  return '업로드 자동 채점 또는 샘플 완료 흐름으로 저장된 결과 기록입니다.';
}

function buildCurrentStageSummary(attempt: AttemptSummary): string {
  if (attempt.status === '준비됨') {
    return '준비 저장만 끝난 상태입니다. 다음에는 실제 업로드나 자동 채점 흐름으로 이어질 수 있습니다.';
  }

  if (attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete) {
    return '업로드는 접수됐지만 후속 처리 완료가 아직 남아 있습니다. 결과 화면에서 상태를 계속 확인해 주세요.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '실제 업로드 자동 채점까지 마친 완료 기록입니다. 다른 시도와 바로 비교할 수 있습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '샘플 preview 기준으로 결과 구조를 먼저 확인한 기록입니다. 실제 업로드 결과와는 구분해서 보면 좋습니다.';
  }

  return '현재 기록은 결과 비교가 가능한 완료 상태입니다.';
}

function buildHistoryStatusMeta(status: AttemptSummary['status']) {
  if (status === '준비됨') {
    return {
      tone: 'neutral' as const,
      icon: 'RDY',
      label: '준비 상태 저장',
    };
  }

  return {
    tone: 'good' as const,
    icon: 'CLR',
    label: '완료 결과 저장',
  };
}

function buildHistoryScoreMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return {
      tone: 'good' as const,
      icon: 'PTS',
      label: '점수 사용 가능',
    };
  }

  return {
    tone: 'warn' as const,
    icon: 'WAIT',
    label: '점수 준비 중',
  };
}

function buildHistorySourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        label: '실제 자동 채점',
      };
    case 'SAMPLE_SCORING_PREVIEW':
      return {
        tone: 'warn' as const,
        icon: 'SAMP',
        label: '샘플 preview 결과',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'SAVE',
        label: '준비 상태 저장',
      };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null) {
  switch (mode) {
    case 'SYNC_INLINE':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        label: '동기 처리',
      };
    case 'ASYNC_JOB_PENDING':
      return {
        tone: 'warn' as const,
        icon: 'WAIT',
        label: '비동기 대기',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'SAVE',
        label: '프로토타입 저장',
      };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean) {
  if (processingComplete) {
    return {
      tone: 'good' as const,
      icon: 'CLR',
      label: '처리 완료',
    };
  }

  return {
    tone: 'warn' as const,
    icon: 'WAIT',
    label: '처리 대기',
  };
}
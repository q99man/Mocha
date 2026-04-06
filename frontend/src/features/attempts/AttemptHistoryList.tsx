import { Link } from 'react-router-dom';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import type { AttemptResultSource, AttemptSummary } from '../../shared/types/attempt';

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

        return (
          <article className="panel panel--section archive-card panel-lift" key={attempt.id}>
            <div className="archive-card__header">
              <div>
                <span className="hero__eyebrow">ATT-{String(attempt.id).padStart(3, '0')}</span>
                <h3>{attempt.challengeTitle}</h3>
                <p>{formatAttemptState(attempt.status)}</p>
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
              <span className="pill">
                <StatusGlyph kind="SAVE" tone="neutral" />
                CH-{String(attempt.challengeId).padStart(2, '0')}
              </span>
            </div>

            <div className="archive-card__banner panel-lift panel-lift--accent">
              <strong>{attempt.resultHeadline}</strong>
              <p>{attempt.resultSummary}</p>
            </div>

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

function formatAttemptState(status: AttemptSummary['status']): string {
  if (status === '준비됨') {
    return '준비 상태 저장 또는 샘플 흐름 시작 전 점검 세션입니다.';
  }

  return '업로드 자동 채점 또는 샘플 완료 결과가 기록된 세션입니다.';
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
        label: '실제 업로드 자동 채점',
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

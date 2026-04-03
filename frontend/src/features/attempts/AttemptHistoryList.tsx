import { Link } from 'react-router-dom';
import type { AttemptSummary } from '../../shared/types/attempt';

type AttemptHistoryListProps = {
  attempts: AttemptSummary[];
};

export function AttemptHistoryList({ attempts }: AttemptHistoryListProps) {
  return (
    <div className="grid">
      {attempts.map((attempt) => (
        <article className="panel" key={attempt.id}>
          <div className="attempt-card__header">
            <div>
              <h3>{attempt.challengeTitle}</h3>
              <p>기록 번호 {attempt.id}</p>
            </div>
            <span className="pill">{attempt.status}</span>
          </div>
          <div className="inline-actions">
            <span className="pill">점수 {attempt.score}점</span>
            <span className="pill">{formatAttemptState(attempt.status)}</span>
          </div>
          <p>저장 시각 {new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
              챌린지 다시 보기
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatAttemptState(status: AttemptSummary['status']): string {
  if (status === '준비됨') {
    return '카메라 준비 기록';
  }

  return '완료된 도전 기록';
}
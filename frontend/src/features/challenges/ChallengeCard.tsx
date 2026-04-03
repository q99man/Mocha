import { Link } from 'react-router-dom';
import type { Challenge } from '../../shared/types/challenge';

type ChallengeCardProps = {
  challenge: Challenge;
};

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  return (
    <article className="challenge-card">
      <Link className="challenge-card__image-link" to={`/challenges/${challenge.id}`} aria-label={`${challenge.title} 상세 보기`}>
        {challenge.thumbnailUrl ? (
          <img className="challenge-card__image" src={challenge.thumbnailUrl} alt={challenge.title} />
        ) : (
          <div className="challenge-card__image challenge-card__image--placeholder">썸네일 준비 중</div>
        )}
      </Link>
      <div className="challenge-card__meta">
        <span className="pill">{challenge.category}</span>
        <span className="pill">{challenge.difficulty}</span>
        <span className="pill">{analysisStatusLabel(challenge.referenceAnalysisStatus)}</span>
      </div>
      <h3>{challenge.title}</h3>
      <p>{challenge.description}</p>
      <div className="challenge-card__footer">
        <span>{challenge.durationSec}초 분량</span>
        <Link className="button-link" to={`/challenges/${challenge.id}`}>
          상세 보기
        </Link>
      </div>
    </article>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return '레퍼런스 분석 완료';
    case 'ANALYZING':
      return '레퍼런스 분석 중';
    case 'FAILED':
      return '레퍼런스 분석 실패';
    default:
      return '레퍼런스 분석 전';
  }
}

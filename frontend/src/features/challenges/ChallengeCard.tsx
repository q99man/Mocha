import { Link } from 'react-router-dom';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import type { Challenge } from '../../shared/types/challenge';

type ChallengeCardProps = {
  challenge: Challenge;
};

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const analysisStatus = buildAnalysisStatusMeta(challenge.referenceAnalysisStatus);
  const referenceStatus = challenge.referenceMotionProfileReady
    ? { tone: 'good' as const, icon: 'RDY', label: 'READY' }
    : { tone: 'warn' as const, icon: 'WAIT', label: 'PENDING' };

  return (
    <article className="challenge-card challenge-card--featured">
      <div className="challenge-card__visual">
        <Link
          className="challenge-card__image-link"
          to={`/challenges/${challenge.id}`}
          aria-label={`${challenge.title} 상세 보기`}
        >
          {challenge.thumbnailUrl ? (
            <img className="challenge-card__image" src={challenge.thumbnailUrl} alt={challenge.title} />
          ) : (
            <div className="challenge-card__image challenge-card__image--placeholder">VISUAL READY SOON</div>
          )}
        </Link>
        <div className="challenge-card__overlay">
          <span className="challenge-card__code">
            <StatusGlyph kind="SAVE" tone="neutral" />
            CH-{String(challenge.id).padStart(2, '0')}
          </span>
          <span className={`challenge-card__status challenge-card__status--${analysisStatus.tone}`}>
            <StatusGlyph kind={analysisStatus.icon} tone={analysisStatus.tone} />
            {analysisStatus.label}
          </span>
        </div>
      </div>

      <div className="challenge-card__body">
        <div className="challenge-card__meta">
          <span className="pill">
            <StatusGlyph kind="SAVE" tone="neutral" />
            {challenge.category}
          </span>
          <span className="pill">
            <StatusGlyph kind="HUD" tone="neutral" />
            {challenge.difficulty}
          </span>
          <span className="pill">
            <StatusGlyph kind="WAIT" tone="neutral" />
            {challenge.durationSec}초
          </span>
        </div>
        <h3>{challenge.title}</h3>
        <p>{challenge.description}</p>
        <div className="challenge-card__footer">
          <div className="challenge-card__metrics">
            <span>REFERENCE</span>
            <strong>{referenceStatus.label}</strong>
            <p className={`challenge-card__metric-badge challenge-card__metric-badge--${referenceStatus.tone}`}>
              <StatusGlyph kind={referenceStatus.icon} tone={referenceStatus.tone} />
              {challenge.referenceMotionProfileReady ? '모션 프로필 준비 완료' : '레퍼런스 준비 중'}
            </p>
          </div>
          <Link className="button-link" to={`/challenges/${challenge.id}`}>
            SELECT
          </Link>
        </div>
      </div>
    </article>
  );
}

function buildAnalysisStatusMeta(status: Challenge['referenceAnalysisStatus']) {
  switch (status) {
    case 'COMPLETED':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        label: 'ANALYSIS READY',
      };
    case 'ANALYZING':
      return {
        tone: 'warn' as const,
        icon: 'HUD',
        label: 'ANALYZING',
      };
    case 'FAILED':
      return {
        tone: 'danger' as const,
        icon: 'ERR',
        label: 'ANALYSIS ERROR',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'WAIT',
        label: 'ANALYSIS WAIT',
      };
  }
}

import { Link } from 'react-router-dom';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import { toAttemptBreakdownLabel } from '../../shared/presentation/attemptBreakdown';
import type { Challenge } from '../../shared/types/challenge';

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const analysisStatus = buildAnalysisStatusMeta(challenge.referenceAnalysisStatus);
  const referenceReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
  const referenceStatus = referenceReady
    ? { tone: 'good' as const, icon: 'RDY', label: 'READY' }
    : { tone: 'warn' as const, icon: 'WAIT', label: 'PENDING' };
  const retrySummary = challenge.latestRetrySummary;

  return (
    <article className="challenge-card challenge-card--featured">
      <div className="challenge-card__visual">
        <Link className="challenge-card__image-link" to={`/challenges/${challenge.id}`} aria-label={`${challenge.title} detail`}>
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
          <span className="pill"><StatusGlyph kind="SAVE" tone="neutral" />{challenge.category}</span>
          <span className="pill"><StatusGlyph kind="HUD" tone="neutral" />{challenge.difficulty}</span>
          <span className="pill"><StatusGlyph kind="WAIT" tone="neutral" />{challenge.durationSec}s</span>
        </div>
        <h3>{challenge.title}</h3>
        <p>{challenge.description}</p>

        {retrySummary ? (
          <div className="challenge-card__retry-strip challenge-card__retry-strip--detailed">
            <div><span>Last score</span><strong>{retrySummary.latestScore} pts</strong></div>
            <div><span>Trend</span><strong className={buildDeltaToneClass(retrySummary.scoreDeltaFromPrevious)}>{formatDelta(retrySummary.scoreDeltaFromPrevious)}</strong></div>
            <div><span>Watch</span><strong>{retrySummary.weakestArea ? toAttemptBreakdownLabel(retrySummary.weakestArea) : 'Review result'}</strong></div>
            <p className="challenge-card__retry-note">{retrySummary.retryFocus ?? retrySummary.keepStableFocus ?? 'Open the latest result to review the full retry plan before recording again.'}</p>
          </div>
        ) : (
          <div className="challenge-card__retry-strip challenge-card__retry-strip--empty">
            <div><span>Retry history</span><strong>No scored runs yet</strong></div>
            <p>The first auto-scored upload for this challenge will become the baseline.</p>
          </div>
        )}

        <div className="challenge-card__footer">
          <div className="challenge-card__metrics">
            <span>REFERENCE</span>
            <strong>{referenceStatus.label}</strong>
            <p className={`challenge-card__metric-badge challenge-card__metric-badge--${referenceStatus.tone}`}>
              <StatusGlyph kind={referenceStatus.icon} tone={referenceStatus.tone} />
              {referenceReady ? 'Ready to challenge' : 'Reference pending'}
            </p>
          </div>
          <div className="challenge-card__cta-group">
            {retrySummary ? (
              <Link className="button-link button-link--secondary" to={`/attempts/${retrySummary.latestAttemptId}/result`}>
                LATEST RESULT
              </Link>
            ) : null}
            <Link className="button-link" to={`/challenges/${challenge.id}`}>{referenceReady ? 'CHALLENGE' : 'DETAIL'}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function buildAnalysisStatusMeta(status: Challenge['referenceAnalysisStatus']) {
  switch (status) {
    case 'COMPLETED':
      return { tone: 'good' as const, icon: 'LIVE', label: 'ANALYSIS READY' };
    case 'ANALYZING':
      return { tone: 'warn' as const, icon: 'HUD', label: 'ANALYZING' };
    case 'FAILED':
      return { tone: 'danger' as const, icon: 'ERR', label: 'ANALYSIS ERROR' };
    default:
      return { tone: 'neutral' as const, icon: 'WAIT', label: 'ANALYSIS WAIT' };
  }
}

function buildDeltaToneClass(delta: number | null) {
  return delta == null || delta === 0 ? '' : delta > 0 ? 'challenge-card__trend challenge-card__trend--up' : 'challenge-card__trend challenge-card__trend--down';
}

function formatDelta(delta: number | null) {
  return delta == null ? 'Baseline' : delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta} pts`;
}
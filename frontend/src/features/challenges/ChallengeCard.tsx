import { Link } from 'react-router-dom';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
import { toAttemptBreakdownLabel } from '../../shared/presentation/attemptBreakdown';
import type { Challenge } from '../../shared/types/challenge';
import { ChallengeVisual } from './ChallengeVisual';

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const analysisStatus = buildAnalysisStatusMeta(challenge.referenceAnalysisStatus);
  const referenceReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
  const referenceStatus = referenceReady
    ? { tone: 'good' as const, icon: 'RDY', label: '준비 완료' }
    : { tone: 'warn' as const, icon: 'WAIT', label: '대기 중' };
  const retrySummary = challenge.latestRetrySummary;

  return (
    <article className="challenge-card challenge-card--featured">
      <div className="challenge-card__visual">
        <Link className="challenge-card__image-link" to={`/challenges/${challenge.id}`} aria-label={`${challenge.title} 상세 보기`}>
          <ChallengeVisual
            title={challenge.title}
            thumbnailUrl={challenge.thumbnailUrl}
            fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
            className="challenge-card__image"
            placeholderClassName="challenge-card__image challenge-card__image--placeholder"
          />
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
          <span className="pill"><StatusGlyph kind="WAIT" tone="neutral" />{challenge.durationSec}초</span>
        </div>
        <h3>{challenge.title}</h3>
        <p>{challenge.description}</p>

        {retrySummary ? (
          <div className="challenge-card__retry-strip challenge-card__retry-strip--detailed">
            <div><span>최근 점수</span><strong>{retrySummary.latestScore}점</strong></div>
            <div><span>변화</span><strong className={buildDeltaToneClass(retrySummary.scoreDeltaFromPrevious)}>{formatDelta(retrySummary.scoreDeltaFromPrevious)}</strong></div>
            <div><span>집중 포인트</span><strong>{retrySummary.weakestArea ? toAttemptBreakdownLabel(retrySummary.weakestArea) : '결과 확인'}</strong></div>
            <p className="challenge-card__retry-note">{retrySummary.retryFocus ?? retrySummary.keepStableFocus ?? '다시 촬영하기 전에 최근 결과를 열어 전체 비교 내용을 확인해 주세요.'}</p>
          </div>
        ) : (
          <div className="challenge-card__retry-strip challenge-card__retry-strip--empty">
            <div><span>재도전 기록</span><strong>아직 채점 기록이 없습니다</strong></div>
            <p>이 챌린지의 첫 자동 채점 업로드가 기준 기록이 됩니다.</p>
          </div>
        )}

        <div className="challenge-card__footer">
          <div className="challenge-card__metrics">
            <span>레퍼런스</span>
            <strong>{referenceStatus.label}</strong>
            <p className={`challenge-card__metric-badge challenge-card__metric-badge--${referenceStatus.tone}`}>
              <StatusGlyph kind={referenceStatus.icon} tone={referenceStatus.tone} />
              {referenceReady ? '도전 가능' : '레퍼런스 준비 중'}
            </p>
          </div>
          <div className="challenge-card__cta-group">
            {retrySummary ? (
              <Link className="button-link button-link--secondary" to={`/attempts/${retrySummary.latestAttemptId}/result`}>
                최근 결과
              </Link>
            ) : null}
            <Link className="button-link" to={`/challenges/${challenge.id}`}>{referenceReady ? '도전하기' : '상세 보기'}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function buildAnalysisStatusMeta(status: Challenge['referenceAnalysisStatus']) {
  switch (status) {
    case 'COMPLETED':
      return { tone: 'good' as const, icon: 'LIVE', label: '분석 완료' };
    case 'ANALYZING':
      return { tone: 'warn' as const, icon: 'HUD', label: '분석 중' };
    case 'FAILED':
      return { tone: 'danger' as const, icon: 'ERR', label: '분석 오류' };
    default:
      return { tone: 'neutral' as const, icon: 'WAIT', label: '분석 대기' };
  }
}

function buildDeltaToneClass(delta: number | null) {
  return delta == null || delta === 0 ? '' : delta > 0 ? 'challenge-card__trend challenge-card__trend--up' : 'challenge-card__trend challenge-card__trend--down';
}

function formatDelta(delta: number | null) {
  return delta == null ? '기준 기록' : delta === 0 ? '변화 없음' : `${delta > 0 ? '+' : ''}${delta}점`;
}

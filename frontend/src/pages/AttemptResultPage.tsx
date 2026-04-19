import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../shared/api/attemptApi';
import { useAnimatedNumber } from '../shared/hooks/useAnimatedNumber';
import type { AttemptSummary, AttemptVideoProcessingJobProgress } from '../shared/types/attempt';

export function AttemptResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('결과 ID가 없습니다.');
      setLoading(false);
      return;
    }

    let active = true;

    async function loadAttempt() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttemptById(Number(id));
        if (active) {
          setAttempt(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '결과 페이지를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempt();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleRefreshProgress() {
    if (!attempt?.pendingTrackingId) {
      return;
    }

    setProgressLoading(true);
    setProgressMessage(null);

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      await applyProgress(progress);
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : '처리 상태를 새로고침하지 못했습니다.');
    } finally {
      setProgressLoading(false);
    }
  }

  async function applyProgress(progress: AttemptVideoProcessingJobProgress) {
    if (progress.resultAttemptId && progress.resultAttemptId !== attempt?.id) {
      navigate(`/attempts/${progress.resultAttemptId}/result`, { replace: true });
      return;
    }

    if (attempt) {
      const refreshed = await getAttemptById(attempt.id);
      setAttempt(refreshed);
    }

    setProgressMessage(buildProgressMessage(progress));
  }

  const pending = !attempt?.processingComplete || attempt?.processingMode === 'ASYNC_JOB_PENDING';
  const flowModeLabel = attempt ? formatResultSource(attempt.resultSource) : '';
  const scoreDelta = attempt?.scoreDeltaFromPrevious ?? null;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;
  const animatedScore = useAnimatedNumber(attempt?.score ?? 0, { duration: 1650 });
  const animatedRate = useAnimatedNumber(Math.max(0, attempt?.score ?? 0), { duration: 1900, decimals: 2 });
  const resultRate = attempt ? `${animatedRate.toFixed(2)}%` : '0.00%';
  const displayedScore = attempt?.scoreAvailable ? animatedScore : '--';
  const headline = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return '결과를 정리하고 있습니다.';
    }

    return attempt.resultHeadline || '결과 분석';
  }, [attempt, pending]);

  const summary = useMemo(() => {
    if (!attempt) {
      return '';
    }

    if (pending) {
      return attempt.processingNotice ?? '최종 분석이 진행 중입니다. 잠시 후 새로고침으로 최신 상태를 확인해 주세요.';
    }

    return attempt.resultSummary;
  }, [attempt, pending]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과를 불러오는 중입니다.</strong>
          <p>점수와 분석 내용을 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과를 찾지 못했습니다.</strong>
          <p>{error ?? '요청한 결과를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link button-link--compact" to="/mypage">
              마이페이지로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="play-result">
      <div className="play-result__left">
        <div className="play-result__mode-label">
          <span>{flowModeLabel}</span>
        </div>

        <h3 className="play-result__judgement-title">결과 분석</h3>

        <div className="play-result__judgement-table">
          <span className="play-result__judgement-label play-result__judgement-label--accent">진행 방식</span>
          <span className="play-result__judgement-value">{flowModeLabel}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">강점</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.strongestArea)}</span>

          <span className="play-result__judgement-label play-result__judgement-label--accent">보완</span>
          <span className="play-result__judgement-value">{formatAreaLabel(attempt.weakestArea)}</span>

          <span className="play-result__judgement-label">상태</span>
          <span className="play-result__judgement-value">{pending ? '처리 중' : '완료'}</span>

          <span className="play-result__judgement-label">이전 대비</span>
          <span className="play-result__judgement-value">{formatDelta(scoreDelta)}</span>
        </div>

        <div className="play-result__summary-card">
          <strong>{headline}</strong>
          <p>{summary}</p>
          <span>기록 번호 {String(attempt.id).padStart(3, '0')}</span>
          {progressMessage ? <p>{progressMessage}</p> : null}
          {attempt.coachingTeaser && !pending ? <p>코칭: {attempt.coachingTeaser}</p> : null}
        </div>

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">챌린지</h4>
          <span className="play-result__meta-value">{attempt.challengeTitle}</span>
        </div>

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">도전 시각</h4>
          <span className="play-result__meta-value">{formatDate(attempt.attemptedAt)}</span>
        </div>

        <div className="play-result__meta-section">
          <h4 className="play-result__meta-title">처리 방식</h4>
          <span className="play-result__meta-value">
            {attempt.processingMode ? formatProcessingMode(attempt.processingMode) : '즉시 처리'}
          </span>
        </div>
      </div>

      <div className="play-result__right">
        <div className="play-result__stat-ring">
          <div className="play-result__stat-item">
            <span>진행</span>
            <strong>{flowModeLabel}</strong>
          </div>
          <div className="play-result__stat-item">
            <span>상태</span>
            <strong>{pending ? '대기' : '완료'}</strong>
          </div>
        </div>

        <div className="play-result__score-circle">
          <span className="play-result__rate">{resultRate}</span>
          <span className="play-result__rate-delta">
            {pending
              ? '결과 분석 연결 중'
              : attempt.resultSource === 'SAMPLE_SCORING_PREVIEW'
                ? '테스트 모드 결과'
                : '상세 결과 연결 완료'}
          </span>
        </div>

        <div className="play-result__score-block">
          <span className="play-result__score-label">점수</span>
          <span className="play-result__score-number">{displayedScore}</span>
          {scoreDelta != null ? (
            <span className="play-result__score-delta">
              {scoreDelta >= 0 ? '+' : '-'} {Math.abs(scoreDelta)}
            </span>
          ) : null}
        </div>

        {isNewRecord ? <span className="play-result__new-record">최고 기록</span> : null}

        <div className="play-result__actions">
          {pending ? (
            <button
              type="button"
              className="play-result__action-btn"
              onClick={() => void handleRefreshProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? '확인 중...' : '새로고침'}
            </button>
          ) : (
            <Link className="play-result__action-btn" to={`/challenges/${attempt.challengeId}/start`}>
              재시도
            </Link>
          )}
          <Link className="play-result__action-btn play-result__action-btn--secondary" to={`/challenges?challengeId=${attempt.challengeId}`}>
            목록으로
          </Link>
        </div>
      </div>
    </div>
  );
}

function buildProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  if (progress.status === 'COMPLETED') {
    return '처리가 완료되어 최신 결과를 다시 불러왔습니다.';
  }
  if (progress.status === 'FAILED') {
    return '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (progress.status === 'PROCESSING') {
    return '분석이 계속 진행 중입니다.';
  }
  return '업로드가 대기열에서 처리 순서를 기다리는 중입니다.';
}

function formatAreaLabel(value: string | null) {
  if (!value) {
    return '없음';
  }

  if (value === 'pose shape') {
    return '포즈 형태';
  }
  if (value === 'pose timing') {
    return '포즈 타이밍';
  }
  if (value === 'detection quality') {
    return '감지 안정성';
  }

  return value;
}

function formatResultSource(value: AttemptSummary['resultSource']) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '영상 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '테스트 모드';
    case 'PREPARED_FLOW':
      return '준비 흐름';
    default:
      return value;
  }
}

function formatProcessingMode(value: NonNullable<AttemptSummary['processingMode']>) {
  switch (value) {
    case 'SYNC_INLINE':
      return '즉시 처리';
    case 'ASYNC_JOB_PENDING':
      return '비동기 처리';
    default:
      return value;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return '기록 없음';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDelta(delta: number | null) {
  if (delta == null) {
    return '--';
  }

  if (delta === 0) {
    return '0';
  }

  return `${delta > 0 ? '+' : ''}${delta}`;
}

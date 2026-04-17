import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../shared/api/attemptApi';
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

  const scoreCards = useMemo(() => {
    if (!attempt) {
      return [];
    }

    return [
      { label: '포즈', value: attempt.poseSimilarity != null ? `${attempt.poseSimilarity}` : '--' },
      { label: '타이밍', value: attempt.timingSimilarity != null ? `${attempt.timingSimilarity}` : '--' },
      { label: '안정성', value: attempt.stabilitySimilarity != null ? `${attempt.stabilitySimilarity}` : '--' },
    ];
  }, [attempt]);

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

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과 데이터를 불러오는 중입니다.</strong>
          <p>점수와 비교 정보를 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>결과를 열지 못했습니다.</strong>
          <p>{error ?? '요청한 결과를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link" to="/attempts">
              기록 목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const pending = !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">시도 결과</span>
          <h2>{attempt.challengeTitle}</h2>
          <p>{attempt.resultHeadline || attempt.resultSummary}</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>점수</span>
            <strong>{attempt.scoreAvailable ? `${attempt.score}` : '--'}</strong>
          </div>
          <div>
            <span>상태</span>
            <strong>{pending ? '처리 중' : '완료'}</strong>
          </div>
          <div>
            <span>이전 대비</span>
            <strong>{formatDelta(attempt.scoreDeltaFromPrevious)}</strong>
          </div>
        </div>
      </section>

      {pending ? (
        <section className="glass-panel">
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">처리 상태</h3>
              <p className="glass-toolbar__note">
                {attempt.processingNotice ?? '최종 분석이 진행 중입니다. 새로고침으로 최신 상태를 확인할 수 있습니다.'}
              </p>
            </div>

            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={progressLoading}
              onClick={() => void handleRefreshProgress()}
            >
              {progressLoading ? '확인 중...' : '상태 새로고침'}
            </button>
          </div>

          {progressMessage ? <p className="review-composer__message review-composer__message--success">{progressMessage}</p> : null}
        </section>
      ) : null}

      <section className="glass-panel">
        <div className="glass-summary-grid">
          {scoreCards.map((card) => (
            <article className="glass-summary-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.label} 유사도 지표</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-list">
          <article className="glass-list-item">
            <div className="glass-list-item__content">
              <div className="glass-list-item__header">
                <div>
                  <span className="glass-list-item__eyebrow">결과 요약</span>
                  <strong>{attempt.resultSummary}</strong>
                </div>
              </div>

              <div className="glass-inline-meta">
                <span>강점 {formatAreaLabel(attempt.strongestArea)}</span>
                <span>보완 {formatAreaLabel(attempt.weakestArea)}</span>
                <span>{formatDate(attempt.attemptedAt)}</span>
              </div>
            </div>
          </article>

          <article className="glass-list-item">
            <div className="glass-list-item__content">
              <div className="glass-list-item__header">
                <div>
                  <span className="glass-list-item__eyebrow">다음 단계</span>
                  <strong>결과 확인 후 바로 다음 동작으로 이어갑니다</strong>
                </div>
              </div>

              <p className="glass-list-item__description">
                같은 챌린지의 기록을 비교하거나, 바로 다시 시도해서 변화량을 확인할 수 있습니다.
              </p>
            </div>

            <div className="glass-list-item__actions">
              <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${attempt.challengeId}`}>
                기록 비교
              </Link>
              <Link className="button-link" to={`/challenges/${attempt.challengeId}/start`}>
                다시 시도
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
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
    return '타이밍';
  }
  if (value === 'detection quality') {
    return '인식 안정성';
  }

  return value;
}

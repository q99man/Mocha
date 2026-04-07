import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AttemptHistoryList } from '../features/attempts/AttemptHistoryList';
import { getAttempts } from '../shared/api/attemptApi';
import type { AttemptResultSource, AttemptSummary } from '../shared/types/attempt';

type AttemptArchiveFilter = 'ALL' | 'SYNC_INLINE' | 'ASYNC_JOB_PENDING' | 'PROTOTYPE' | 'ATTENTION';
type AttemptSourceFilter = 'ALL' | AttemptResultSource;

export function AttemptsPage() {
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AttemptArchiveFilter>('ALL');
  const [activeSourceFilter, setActiveSourceFilter] = useState<AttemptSourceFilter>('ALL');

  useEffect(() => {
    let active = true;

    async function loadAttempts() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttempts();
        if (active) {
          setAttempts(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '도전 기록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempts();

    return () => {
      active = false;
    };
  }, []);

  const completedCount = attempts.filter((attempt) => attempt.status === '완료됨').length;
  const preparedCount = attempts.filter((attempt) => attempt.status === '준비됨').length;
  const autoscoredCount = attempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED').length;
  const sampleCount = attempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW').length;
  const preparedSourceCount = attempts.filter((attempt) => attempt.resultSource === 'PREPARED_FLOW').length;
  const syncInlineCount = attempts.filter((attempt) => attempt.processingMode === 'SYNC_INLINE').length;
  const asyncPendingCount = attempts.filter(
    (attempt) => attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete,
  ).length;
  const prototypeCount = attempts.filter((attempt) => attempt.processingMode === null).length;
  const attentionCount = attempts.filter(isAttentionAttempt).length;

  const processingFilteredAttempts = useMemo(() => {
    switch (activeFilter) {
      case 'SYNC_INLINE':
        return attempts.filter((attempt) => attempt.processingMode === 'SYNC_INLINE');
      case 'ASYNC_JOB_PENDING':
        return attempts.filter(
          (attempt) => attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete,
        );
      case 'PROTOTYPE':
        return attempts.filter((attempt) => attempt.processingMode === null);
      case 'ATTENTION':
        return attempts.filter(isAttentionAttempt);
      default:
        return attempts;
    }
  }, [activeFilter, attempts]);

  const filteredAttempts = useMemo(() => {
    if (activeSourceFilter === 'ALL') {
      return processingFilteredAttempts;
    }

    return processingFilteredAttempts.filter((attempt) => attempt.resultSource === activeSourceFilter);
  }, [activeSourceFilter, processingFilteredAttempts]);

  const showAttentionSummary = activeFilter === 'ATTENTION' && attempts.length > 0;

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">ARCHIVE / ATTEMPT LOG</span>
          <h2>준비 기록과 완료 결과를 한 화면에서 비교하는 아카이브 콘솔</h2>
          <p>
            Mocha의 현재 MVP 흐름에서는 준비 저장, 샘플 preview, 실제 업로드 자동 채점 결과가 같은 기록 구조를 공유합니다.
            이 화면에서는 처리 방식과 결과 출처를 함께 보면서 어떤 흐름으로 저장됐는지 빠르게 비교할 수 있습니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/challenges">
              챌린지로 이동
            </Link>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift">
              <span>TOTAL</span>
              <strong>{String(attempts.length).padStart(2, '0')}</strong>
              <p>전체 저장 기록</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>CLEAR</span>
              <strong>{String(completedCount).padStart(2, '0')}</strong>
              <p>완료 결과</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>READY</span>
              <strong>{String(preparedCount).padStart(2, '0')}</strong>
              <p>준비 상태</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>LIVE</span>
              <strong>{String(autoscoredCount).padStart(2, '0')}</strong>
              <p>실제 자동 채점</p>
            </div>
          </div>
        </div>
      </section>

      {!loading && !error && attempts.length > 0 ? (
        <>
          <section className="panel panel--section panel-lift">
            <div className="section-heading">
              <span className="section-heading__code">01</span>
              <div>
                <h2>기록 분포 요약</h2>
                <p>어떤 종류의 결과가 많은지 먼저 보고, 아래 카드에서 개별 흐름을 비교할 수 있습니다.</p>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-card stat-card--accent panel-lift panel-lift--accent">
                <strong>실제 업로드 자동 채점</strong>
                <p>{autoscoredCount}건</p>
              </div>
              <div className="stat-card panel-lift">
                <strong>샘플 preview 결과</strong>
                <p>{sampleCount}건</p>
              </div>
              <div className="stat-card panel-lift">
                <strong>준비 상태 저장</strong>
                <p>{preparedSourceCount}건</p>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-card panel-lift">
                <strong>동기 처리</strong>
                <p>{syncInlineCount}건</p>
              </div>
              <div className="stat-card panel-lift">
                <strong>비동기 대기</strong>
                <p>{asyncPendingCount}건</p>
              </div>
              <div className="stat-card panel-lift">
                <strong>프로토타입 저장</strong>
                <p>{prototypeCount}건</p>
              </div>
              <div className="stat-card panel-lift">
                <strong>처리 확인 필요</strong>
                <p>{attentionCount}건</p>
              </div>
            </div>
          </section>

          <section className="panel panel--section panel-lift">
            <div className="section-heading">
              <span className="section-heading__code">02</span>
              <div>
                <h2>처리 방식 필터</h2>
                <p>동기 처리, 비동기 대기, 프로토타입 저장 중 보고 싶은 흐름만 바로 고를 수 있습니다.</p>
              </div>
            </div>
            <div className="archive-filter-group">
              {[
                { key: 'ALL', label: '전체 보기', count: attempts.length },
                { key: 'SYNC_INLINE', label: '동기 처리', count: syncInlineCount },
                { key: 'ASYNC_JOB_PENDING', label: '비동기 대기', count: asyncPendingCount },
                { key: 'PROTOTYPE', label: '프로토타입 저장', count: prototypeCount },
                { key: 'ATTENTION', label: '처리 확인 필요', count: attentionCount },
              ].map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                    onClick={() => setActiveFilter(filter.key as AttemptArchiveFilter)}
                  >
                    <span>{filter.label}</span>
                    <strong>{filter.count}건</strong>
                  </button>
                );
              })}
            </div>
            <p className="archive-filter__summary">
              현재 <strong>{processingFilterLabel(activeFilter)}</strong> 기준으로{' '}
              <strong>{processingFilteredAttempts.length}건</strong>의 기록을 보고 있습니다.
            </p>
            {showAttentionSummary ? (
              <div className="archive-attention-summary">
                <strong>처리 확인이 필요한 기록을 모아보고 있습니다.</strong>
                <p>
                  현재 <strong>{processingFilteredAttempts.length}건</strong>이 후속 확인 또는 재시도가 필요한 상태입니다.
                  실제 자동 채점 결과와 프로토타입 저장 흐름이 섞여 있을 수 있으니, 아래 결과 출처 필터로 더 좁혀보면 빠르게 확인할 수 있습니다.
                </p>
              </div>
            ) : null}
          </section>

          <section className="panel panel--section panel-lift">
            <div className="section-heading">
              <span className="section-heading__code">03</span>
              <div>
                <h2>결과 출처 필터</h2>
                <p>실제 자동 채점 결과인지, 샘플 preview인지, 준비 상태 저장 기록인지 출처 기준으로 다시 좁혀볼 수 있습니다.</p>
              </div>
            </div>
            <div className="archive-filter-group">
              {[
                { key: 'ALL', label: '전체 출처', count: processingFilteredAttempts.length },
                {
                  key: 'VIDEO_UPLOAD_AUTOSCORED',
                  label: '실제 자동 채점',
                  count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED').length,
                },
                {
                  key: 'SAMPLE_SCORING_PREVIEW',
                  label: '샘플 preview',
                  count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW').length,
                },
                {
                  key: 'PREPARED_FLOW',
                  label: '준비 상태 저장',
                  count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'PREPARED_FLOW').length,
                },
              ].map((filter) => {
                const isActive = activeSourceFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                    onClick={() => setActiveSourceFilter(filter.key as AttemptSourceFilter)}
                  >
                    <span>{filter.label}</span>
                    <strong>{filter.count}건</strong>
                  </button>
                );
              })}
            </div>
            <p className="archive-filter__summary">
              현재 <strong>{sourceFilterLabel(activeSourceFilter)}</strong> 기준으로 <strong>{filteredAttempts.length}건</strong>의 기록을 보고 있습니다.
            </p>
          </section>
        </>
      ) : null}

      {loading ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">LOADING</span>
            <div>
              <h2>도전 기록을 불러오는 중입니다</h2>
              <p>저장된 세션 로그와 결과 이력을 아카이브 화면으로 정리하고 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="panel panel--error panel--section">
          <div className="section-heading">
            <span className="section-heading__code">ERROR</span>
            <div>
              <h2>도전 기록을 불러오지 못했습니다</h2>
              <p>{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && attempts.length === 0 ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">EMPTY</span>
            <div>
              <h2>아직 저장된 기록이 없습니다</h2>
              <p>챌린지를 시작하고 준비 상태를 저장하거나 업로드 흐름을 진행하면 여기에서 바로 비교할 수 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && filteredAttempts.length > 0 ? <AttemptHistoryList attempts={filteredAttempts} /> : null}

      {!loading && !error && attempts.length > 0 && filteredAttempts.length === 0 ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">FILTER</span>
            <div>
              <h2>선택한 필터에 맞는 기록이 없습니다</h2>
              <p>다른 처리 방식이나 결과 출처를 선택하면 저장된 기록을 다시 확인할 수 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function isAttentionAttempt(attempt: AttemptSummary) {
  return !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';
}

function processingFilterLabel(filter: AttemptArchiveFilter): string {
  switch (filter) {
    case 'SYNC_INLINE':
      return '동기 처리';
    case 'ASYNC_JOB_PENDING':
      return '비동기 대기';
    case 'PROTOTYPE':
      return '프로토타입 저장';
    case 'ATTENTION':
      return '처리 확인 필요';
    default:
      return '전체 보기';
  }
}

function sourceFilterLabel(filter: AttemptSourceFilter): string {
  switch (filter) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '실제 자동 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '샘플 preview';
    case 'PREPARED_FLOW':
      return '준비 상태 저장';
    default:
      return '전체 출처';
  }
}
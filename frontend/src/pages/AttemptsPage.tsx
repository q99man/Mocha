import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Pagination } from '../shared/components/Pagination';
import { getAttempts } from '../shared/api/attemptApi';
import { useAuth } from '../shared/auth/AuthProvider';
import type { AttemptSummary } from '../shared/types/attempt';

type AttemptFilter = 'ALL' | 'COMPLETED' | 'PENDING';
type AttemptSort = 'RECENT' | 'SCORE_HIGH' | 'SCORE_LOW';

const ITEMS_PER_PAGE = 8;

export function AttemptsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AttemptFilter>('ALL');
  const [activeSort, setActiveSort] = useState<AttemptSort>('RECENT');
  const [currentPage, setCurrentPage] = useState(1);

  const challengeIdParam = searchParams.get('challengeId');
  const challengeIdFilter = challengeIdParam ? Number(challengeIdParam) : null;

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
          setError(loadError instanceof Error ? loadError.message : '기록 목록을 불러오지 못했습니다.');
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

  const challengeOptions = useMemo(() => {
    const map = new Map<number, { id: number; title: string; count: number }>();

    for (const attempt of attempts) {
      const current = map.get(attempt.challengeId);
      if (current) {
        current.count += 1;
      } else {
        map.set(attempt.challengeId, {
          id: attempt.challengeId,
          title: attempt.challengeTitle,
          count: 1,
        });
      }
    }

    return Array.from(map.values()).sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts
      .filter((attempt) => {
        if (activeFilter === 'COMPLETED') {
          return attempt.status === 'Completed';
        }
        if (activeFilter === 'PENDING') {
          return !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';
        }
        return true;
      })
      .filter((attempt) => (challengeIdFilter ? attempt.challengeId === challengeIdFilter : true))
      .sort((left, right) => {
        if (activeSort === 'SCORE_HIGH') {
          return right.score - left.score;
        }
        if (activeSort === 'SCORE_LOW') {
          return left.score - right.score;
        }
        return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
      });
  }, [activeFilter, activeSort, attempts, challengeIdFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAttempts.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, activeSort, challengeIdFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedAttempts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAttempts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredAttempts]);

  const summary = useMemo(() => {
    const completed = attempts.filter((attempt) => attempt.status === 'Completed').length;
    const pending = attempts.filter((attempt) => !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING').length;
    const best = attempts.reduce<AttemptSummary | null>(
      (currentBest, attempt) => (!currentBest || attempt.score > currentBest.score ? attempt : currentBest),
      null,
    );

    return {
      total: attempts.length,
      completed,
      pending,
      best,
    };
  }, [attempts]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>기록 목록을 불러오는 중입니다.</strong>
          <p>최근 시도와 결과 흐름을 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>기록 목록을 불러오지 못했습니다.</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">Attempt Archive</span>
          <h2>기록은 한 화면에서 빠르게 훑고 이동합니다</h2>
          <p>불필요한 상태 카드 대신 전체 수, 처리 대기, 최고 점수만 남기고 나머지는 리스트와 페이징으로 정리했습니다.</p>
        </div>
        <div className="glass-intro__meta">
          <div>
            <span>전체</span>
            <strong>{String(summary.total).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>대기</span>
            <strong>{String(summary.pending).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>최고 점수</span>
            <strong>{summary.best ? `${summary.best.score}` : '--'}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar glass-toolbar--stack">
          <div className="glass-chip-group">
            {[
              { key: 'ALL' as const, label: '전체' },
              { key: 'COMPLETED' as const, label: '완료' },
              { key: 'PENDING' as const, label: '대기' },
            ].map((option) => (
              <button
                key={option.key}
                className={`glass-chip${activeFilter === option.key ? ' is-active' : ''}`}
                type="button"
                onClick={() => setActiveFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="glass-toolbar__row">
            <label className="glass-select">
              <span>챌린지</span>
              <select
                value={challengeIdFilter ?? 'ALL'}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const nextParams = new URLSearchParams(searchParams);
                  if (nextValue === 'ALL') {
                    nextParams.delete('challengeId');
                  } else {
                    nextParams.set('challengeId', nextValue);
                  }
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                <option value="ALL">전체</option>
                {challengeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} ({option.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="glass-select">
              <span>정렬</span>
              <select value={activeSort} onChange={(event) => setActiveSort(event.target.value as AttemptSort)}>
                <option value="RECENT">최신순</option>
                <option value="SCORE_HIGH">점수 높은 순</option>
                <option value="SCORE_LOW">점수 낮은 순</option>
              </select>
            </label>
          </div>
        </div>

        {pagedAttempts.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>조건에 맞는 기록이 없습니다.</strong>
            <p>필터를 바꾸거나 챌린지를 다시 시도해 보세요.</p>
          </div>
        ) : (
          <div className="glass-list">
            {pagedAttempts.map((attempt) => (
              <article className="glass-list-item" key={attempt.id}>
                <div className="glass-list-item__content">
                  <div className="glass-list-item__header">
                    <div>
                      <span className="glass-list-item__eyebrow">{formatDate(attempt.attemptedAt)}</span>
                      <strong>{attempt.challengeTitle}</strong>
                    </div>
                    <span className={`glass-badge${attempt.processingComplete ? ' is-accent' : ''}`}>
                      {attempt.processingComplete ? 'Completed' : 'Pending'}
                    </span>
                  </div>

                  <div className="glass-inline-meta">
                    <span>점수 {attempt.scoreAvailable ? `${attempt.score}점` : '대기 중'}</span>
                    <span>{attempt.resultSource}</span>
                    <span>{attempt.weakestArea ?? '취약 영역 없음'}</span>
                  </div>

                  <p className="glass-list-item__description">
                    {attempt.resultHeadline || attempt.resultSummary}
                  </p>
                </div>

                <div className="glass-list-item__actions">
                  <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
                    챌린지
                  </Link>
                  <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                    결과
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="glass-toolbar">
          <p className="glass-toolbar__note">
            {user ? `${user.displayName}님의 기록 ${filteredAttempts.length}개` : `${filteredAttempts.length}개 기록`}
          </p>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
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

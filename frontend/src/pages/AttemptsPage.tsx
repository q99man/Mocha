import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AttemptHistoryList } from '../features/attempts/AttemptHistoryList';
import { getAttempts } from '../shared/api/attemptApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import type { AttemptBreakdownArea, AttemptResultSource, AttemptSummary } from '../shared/types/attempt';

type AttemptArchiveFilter = 'ALL' | 'SYNC_INLINE' | 'ASYNC_JOB_PENDING' | 'PROTOTYPE' | 'ATTENTION';
type AttemptSourceFilter = 'ALL' | AttemptResultSource;
type AttemptWeaknessFilter = 'ALL' | AttemptBreakdownArea;
type AttemptSort = 'RECENT' | 'OLDEST' | 'SCORE_HIGH' | 'SCORE_LOW' | 'MOST_IMPROVED' | 'MOST_DROPPED';
type AttemptChallengeFilter = 'ALL' | number;

export function AttemptsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AttemptArchiveFilter>('ALL');
  const [activeSourceFilter, setActiveSourceFilter] = useState<AttemptSourceFilter>('ALL');
  const [activeWeaknessFilter, setActiveWeaknessFilter] = useState<AttemptWeaknessFilter>('ALL');
  const [activeChallengeFilter, setActiveChallengeFilter] = useState<AttemptChallengeFilter>(() => parseChallengeFilter(searchParams.get('challengeId')));
  const [activeSort, setActiveSort] = useState<AttemptSort>('RECENT');
  const isMountedRef = useRef(true);

  async function loadAttemptsFromServer(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await getAttempts();
      if (isMountedRef.current) {
        setAttempts(response);
        if (!silent) {
          setError(null);
        }
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '시도 목록을 불러오지 못했습니다.';
      if (isMountedRef.current && !silent) {
        setError(message);
      }
      if (silent) {
        throw new Error(message);
      }
    } finally {
      if (isMountedRef.current && !silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    void loadAttemptsFromServer();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextFilter = parseChallengeFilter(searchParams.get('challengeId'));
    setActiveChallengeFilter((current) => (current === nextFilter ? current : nextFilter));
  }, [searchParams]);

  useEffect(() => {
    const currentParam = searchParams.get('challengeId');
    const nextParams = new URLSearchParams(searchParams);

    if (activeChallengeFilter === 'ALL') {
      nextParams.delete('challengeId');
    } else {
      nextParams.set('challengeId', String(activeChallengeFilter));
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeChallengeFilter, searchParams, setSearchParams]);

  const counts = useMemo(() => {
    const completed = attempts.filter((attempt) => attempt.status === 'Completed').length;
    const prepared = attempts.filter((attempt) => attempt.status === 'Prepared').length;
    const autoscored = attempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED').length;
    const sample = attempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW').length;
    const preparedSource = attempts.filter((attempt) => attempt.resultSource === 'PREPARED_FLOW').length;
    const syncInline = attempts.filter((attempt) => attempt.processingMode === 'SYNC_INLINE').length;
    const asyncPending = attempts.filter((attempt) => attempt.processingMode === 'ASYNC_JOB_PENDING').length;
    const attention = attempts.filter(isAttentionAttempt).length;
    const prototype = attempts.filter((attempt) => attempt.processingMode === null).length;
    const weakPose = attempts.filter((attempt) => attempt.weakestArea === 'pose shape').length;
    const weakTiming = attempts.filter((attempt) => attempt.weakestArea === 'pose timing').length;
    const weakStability = attempts.filter((attempt) => attempt.weakestArea === 'detection quality').length;

    return {
      completed,
      prepared,
      autoscored,
      sample,
      preparedSource,
      syncInline,
      asyncPending,
      attention,
      prototype,
      weakPose,
      weakTiming,
      weakStability,
    };
  }, [attempts]);

  const challengeFocusOptions = useMemo(() => {
    const byChallenge = new Map<number, { challengeId: number; challengeTitle: string; count: number; latestAttemptedAt: string }>();

    for (const attempt of attempts) {
      const current = byChallenge.get(attempt.challengeId);
      if (!current) {
        byChallenge.set(attempt.challengeId, {
          challengeId: attempt.challengeId,
          challengeTitle: attempt.challengeTitle,
          count: 1,
          latestAttemptedAt: attempt.attemptedAt,
        });
        continue;
      }

      current.count += 1;
      if (new Date(attempt.attemptedAt).getTime() > new Date(current.latestAttemptedAt).getTime()) {
        current.latestAttemptedAt = attempt.attemptedAt;
      }
    }

    return Array.from(byChallenge.values())
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return new Date(right.latestAttemptedAt).getTime() - new Date(left.latestAttemptedAt).getTime();
      })
      .slice(0, 6);
  }, [attempts]);

  const processingFilteredAttempts = useMemo(() => {
    switch (activeFilter) {
      case 'SYNC_INLINE':
        return attempts.filter((attempt) => attempt.processingMode === 'SYNC_INLINE');
      case 'ASYNC_JOB_PENDING':
        return attempts.filter((attempt) => attempt.processingMode === 'ASYNC_JOB_PENDING');
      case 'PROTOTYPE':
        return attempts.filter((attempt) => attempt.processingMode === null);
      case 'ATTENTION':
        return attempts.filter(isAttentionAttempt);
      default:
        return attempts;
    }
  }, [activeFilter, attempts]);

  const sourceFilteredAttempts = useMemo(() => {
    if (activeSourceFilter === 'ALL') {
      return processingFilteredAttempts;
    }
    return processingFilteredAttempts.filter((attempt) => attempt.resultSource === activeSourceFilter);
  }, [activeSourceFilter, processingFilteredAttempts]);

  const weaknessFilteredAttempts = useMemo(() => {
    if (activeWeaknessFilter === 'ALL') {
      return sourceFilteredAttempts;
    }
    return sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === activeWeaknessFilter);
  }, [activeWeaknessFilter, sourceFilteredAttempts]);

  const challengeFilteredAttempts = useMemo(() => {
    if (activeChallengeFilter === 'ALL') {
      return weaknessFilteredAttempts;
    }
    return weaknessFilteredAttempts.filter((attempt) => attempt.challengeId === activeChallengeFilter);
  }, [activeChallengeFilter, weaknessFilteredAttempts]);

  const comparisonDeltaByAttemptId = useMemo(() => {
    const deltaByAttemptId = new Map<number, number>();

    for (const attempt of attempts) {
      if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable) {
        continue;
      }

      deltaByAttemptId.set(attempt.id, attempt.scoreDeltaFromPrevious ?? 0);
    }

    return deltaByAttemptId;
  }, [attempts]);

  const comparisonDeltaRecord = useMemo(() => Object.fromEntries(comparisonDeltaByAttemptId), [comparisonDeltaByAttemptId]);

  const activeChallengeMeta = useMemo(() => {
    if (activeChallengeFilter === 'ALL') {
      return null;
    }

    const option = challengeFocusOptions.find((item) => item.challengeId === activeChallengeFilter);
    if (option) {
      return option;
    }

    const fallback = attempts.find((attempt) => attempt.challengeId === activeChallengeFilter);
    return fallback
      ? { challengeId: fallback.challengeId, challengeTitle: fallback.challengeTitle, count: 0, latestAttemptedAt: fallback.attemptedAt }
      : null;
  }, [activeChallengeFilter, attempts, challengeFocusOptions]);

  const filteredAttempts = useMemo(() => {
    const sorted = [...challengeFilteredAttempts];

    sorted.sort((left, right) => {
      switch (activeSort) {
        case 'OLDEST':
          return new Date(left.attemptedAt).getTime() - new Date(right.attemptedAt).getTime();
        case 'SCORE_HIGH':
          if (right.score !== left.score) {
            return right.score - left.score;
          }
          return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
        case 'SCORE_LOW':
          if (left.score !== right.score) {
            return left.score - right.score;
          }
          return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
        case 'MOST_IMPROVED': {
          const leftDelta = comparisonDeltaByAttemptId.get(left.id) ?? Number.NEGATIVE_INFINITY;
          const rightDelta = comparisonDeltaByAttemptId.get(right.id) ?? Number.NEGATIVE_INFINITY;
          if (rightDelta !== leftDelta) {
            return rightDelta - leftDelta;
          }
          return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
        }
        case 'MOST_DROPPED': {
          const leftDelta = comparisonDeltaByAttemptId.get(left.id) ?? Number.POSITIVE_INFINITY;
          const rightDelta = comparisonDeltaByAttemptId.get(right.id) ?? Number.POSITIVE_INFINITY;
          if (leftDelta !== rightDelta) {
            return leftDelta - rightDelta;
          }
          return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
        }
        case 'RECENT':
        default:
          return new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime();
      }
    });

    return sorted;
  }, [activeSort, challengeFilteredAttempts, comparisonDeltaByAttemptId]);

  const weaknessFilterOptions = useMemo(
    () => [
      { key: 'ALL' as const, label: '전체 취약 영역', count: sourceFilteredAttempts.length },
      {
        key: 'pose shape' as const,
        label: toAttemptBreakdownLabel('pose shape'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'pose shape').length,
      },
      {
        key: 'pose timing' as const,
        label: toAttemptBreakdownLabel('pose timing'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'pose timing').length,
      },
      {
        key: 'detection quality' as const,
        label: toAttemptBreakdownLabel('detection quality'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'detection quality').length,
      },
    ],
    [sourceFilteredAttempts],
  );

  if (loading) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">LOADING</span>
          <div>
            <h2>시도 기록을 불러오는 중입니다</h2>
            <p>아카이브와 최신 채점 결과를 새로고침하고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">ERROR</span>
          <div>
            <h2>시도 아카이브를 불러오지 못했습니다</h2>
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">아카이브 / 시도 기록</span>
          <h2>준비 기록, 샘플 미리보기, 실제 업로드 결과를 한곳에서 비교해 보세요</h2>
          <p>
            이 화면은 채점 아카이브를 읽기 쉽게 유지하면서 추가 처리 확인이 필요한 시도도 함께 보여줍니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/challenges">
              챌린지 목록 열기
            </Link>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift">
              <span>전체</span>
              <strong>{String(attempts.length).padStart(2, '0')}</strong>
              <p>저장된 전체 시도</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>완료</span>
              <strong>{String(counts.completed).padStart(2, '0')}</strong>
              <p>완료된 결과</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>준비</span>
              <strong>{String(counts.prepared).padStart(2, '0')}</strong>
              <p>준비 상태만 존재</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>실채점</span>
              <strong>{String(counts.autoscored).padStart(2, '0')}</strong>
              <p>자동 채점 업로드</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">01</span>
          <div>
            <h2>아카이브 요약</h2>
            <p>실업로드, 준비 기록, 샘플 미리보기에서 각각 몇 건의 시도가 왔는지 확인합니다.</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card stat-card--accent panel-lift panel-lift--accent">
            <strong>자동 채점 업로드</strong>
            <p>{counts.autoscored}건</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>샘플 미리보기</strong>
            <p>{counts.sample}건</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>준비 기록만</strong>
            <p>{counts.preparedSource}건</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>확인 필요</strong>
            <p>{counts.attention}건</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('pose shape')} 취약</strong>
            <p>{counts.weakPose}건</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('pose timing')} 취약</strong>
            <p>{counts.weakTiming}건</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('detection quality')} 취약</strong>
            <p>{counts.weakStability}건</p>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">02</span>
          <div>
            <h2>처리 상태 필터</h2>
            <p>즉시 처리 결과, 비동기 대기 업로드, 프로토타입성 기록을 전환해 볼 수 있습니다.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'ALL', label: '전체', count: attempts.length },
            { key: 'SYNC_INLINE', label: '즉시 처리', count: counts.syncInline },
            { key: 'ASYNC_JOB_PENDING', label: '비동기 대기', count: counts.asyncPending },
            { key: 'PROTOTYPE', label: '프로토타입/기본', count: counts.prototype },
            { key: 'ATTENTION', label: '확인 필요', count: counts.attention },
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
                <strong>{filter.count}</strong>
              </button>
            );
          })}
        </div>
        <p className="archive-filter__summary">
          <strong>{processingFilterLabel(activeFilter)}</strong> 기준으로 <strong>{processingFilteredAttempts.length}</strong>건을 보고 있습니다.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">03</span>
          <div>
            <h2>결과 출처 필터</h2>
            <p>실제 업로드 채점 결과와 미리보기, 준비 기록을 구분해서 볼 수 있습니다.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'ALL', label: '전체 출처', count: processingFilteredAttempts.length },
            {
              key: 'VIDEO_UPLOAD_AUTOSCORED',
              label: '자동 채점 업로드',
              count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED')
                .length,
            },
            {
              key: 'SAMPLE_SCORING_PREVIEW',
              label: '샘플 미리보기',
              count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW')
                .length,
            },
            {
              key: 'PREPARED_FLOW',
              label: '준비 흐름',
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
                <strong>{filter.count}</strong>
              </button>
            );
          })}
        </div>
        <p className="archive-filter__summary">
          <strong>{sourceFilterLabel(activeSourceFilter)}</strong> 기준으로 <strong>{sourceFilteredAttempts.length}</strong>건을 보고 있습니다.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">04</span>
          <div>
            <h2>취약 영역 필터</h2>
            <p>포즈 모양, 포즈 타이밍, 검출 품질 중 특히 보완이 필요한 시도에 집중할 수 있습니다.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {weaknessFilterOptions.map((filter) => {
            const isActive = activeWeaknessFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                onClick={() => setActiveWeaknessFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            );
          })}
        </div>
        <p className="archive-filter__summary">
          <strong>{weaknessFilterLabel(activeWeaknessFilter)}</strong> 기준으로 <strong>{weaknessFilteredAttempts.length}</strong>건을 보고 있습니다.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">05</span>
          <div>
            <h2>챌린지 집중 보기</h2>
            <p>재도전이 많이 쌓인 챌린지로 바로 이동해 최근 결과를 함께 비교할 수 있습니다.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          <button
            type="button"
            className={`archive-filter ${activeChallengeFilter === 'ALL' ? 'archive-filter--active' : ''}`}
            onClick={() => setActiveChallengeFilter('ALL')}
          >
            <span>전체 챌린지</span>
            <strong>{weaknessFilteredAttempts.length}</strong>
          </button>
          {challengeFocusOptions.map((option) => {
            const isActive = activeChallengeFilter === option.challengeId;
            return (
              <button
                key={option.challengeId}
                type="button"
                className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                onClick={() => setActiveChallengeFilter(option.challengeId)}
              >
                <span>{option.challengeTitle}</span>
                <strong>{option.count}</strong>
              </button>
            );
          })}
        </div>
        <p className="archive-filter__summary">
          <strong>{challengeFilterLabel(activeChallengeFilter, challengeFocusOptions)}</strong> 기준으로 <strong>{challengeFilteredAttempts.length}</strong>건을 보고 있습니다.
        </p>
        {activeChallengeMeta ? (
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${activeChallengeMeta.challengeId}`}>
              챌린지 상세 보기
            </Link>
            <Link className="button-link button-link--secondary" to={`/challenges/${activeChallengeMeta.challengeId}/start`}>
              이 챌린지 다시 도전
            </Link>
          </div>
        ) : null}
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">06</span>
          <div>
            <h2>정렬</h2>
            <p>최근 순서나 점수 순서로 시도를 다시 정렬해 재도전 비교를 빠르게 할 수 있습니다.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'RECENT', label: '최신순' },
            { key: 'OLDEST', label: '오래된순' },
            { key: 'SCORE_HIGH', label: '점수 높은순' },
            { key: 'SCORE_LOW', label: '점수 낮은순' },
            { key: 'MOST_IMPROVED', label: '가장 많이 향상' },
            { key: 'MOST_DROPPED', label: '가장 많이 하락' },
          ].map((option) => {
            const isActive = activeSort === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                onClick={() => setActiveSort(option.key as AttemptSort)}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="archive-filter__summary">
          <strong>{sortLabel(activeSort)}</strong> 정렬이 <strong>{filteredAttempts.length}</strong>건에 적용되었습니다.
        </p>
      </section>

      {filteredAttempts.length === 0 ? (
        <section className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">비어 있음</span>
            <div>
              <h2>현재 필터에 맞는 시도가 없습니다</h2>
              <p>필터를 바꾸거나 새 챌린지 시도를 먼저 만들어 주세요.</p>
            </div>
          </div>
        </section>
      ) : (
        <AttemptHistoryList
          attempts={filteredAttempts}
          comparisonDeltaByAttemptId={comparisonDeltaRecord}
          onArchiveRefreshRequested={() => loadAttemptsFromServer({ silent: true })}
        />
      )}
    </div>
  );
}

function isAttentionAttempt(attempt: AttemptSummary) {
  return !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';
}

function processingFilterLabel(filter: AttemptArchiveFilter) {
  switch (filter) {
    case 'SYNC_INLINE':
      return '즉시 처리';
    case 'ASYNC_JOB_PENDING':
      return '비동기 대기';
    case 'PROTOTYPE':
      return '프로토타입/기본';
    case 'ATTENTION':
      return '확인 필요';
    default:
      return '전체 처리 상태';
  }
}

function sourceFilterLabel(filter: AttemptSourceFilter) {
  switch (filter) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '자동 채점 업로드';
    case 'SAMPLE_SCORING_PREVIEW':
      return '샘플 미리보기';
    case 'PREPARED_FLOW':
      return '준비 흐름';
    default:
      return '전체 출처';
  }
}

function weaknessFilterLabel(filter: AttemptWeaknessFilter) {
  if (filter === 'ALL') {
    return '전체 취약 영역';
  }

  return toAttemptBreakdownLabel(filter);
}

function challengeFilterLabel(
  filter: AttemptChallengeFilter,
  options: { challengeId: number; challengeTitle: string; count: number; latestAttemptedAt: string }[],
) {
  if (filter === 'ALL') {
    return '전체 챌린지';
  }

  return options.find((option) => option.challengeId === filter)?.challengeTitle ?? `챌린지 #${filter}`;
}

function parseChallengeFilter(value: string | null): AttemptChallengeFilter {
  if (!value) {
    return 'ALL';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 'ALL';
}

function sortLabel(sort: AttemptSort) {
  switch (sort) {
    case 'OLDEST':
      return '오래된순';
    case 'SCORE_HIGH':
      return '점수 높은순';
    case 'SCORE_LOW':
      return '점수 낮은순';
    case 'MOST_IMPROVED':
      return '상승 폭 큰순';
    case 'MOST_DROPPED':
      return '하락 폭 큰순';
    case 'RECENT':
    default:
      return '최신순';
  }
}

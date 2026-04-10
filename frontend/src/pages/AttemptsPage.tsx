import { useEffect, useMemo, useState } from 'react';
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load attempts.');
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
    const weakPose = attempts.filter((attempt) => attempt.weakestArea === 'pose similarity').length;
    const weakTiming = attempts.filter((attempt) => attempt.weakestArea === 'timing').length;
    const weakStability = attempts.filter((attempt) => attempt.weakestArea === 'detection stability').length;

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
      { key: 'ALL' as const, label: 'All weaknesses', count: sourceFilteredAttempts.length },
      {
        key: 'pose similarity' as const,
        label: toAttemptBreakdownLabel('pose similarity'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'pose similarity').length,
      },
      {
        key: 'timing' as const,
        label: toAttemptBreakdownLabel('timing'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'timing').length,
      },
      {
        key: 'detection stability' as const,
        label: toAttemptBreakdownLabel('detection stability'),
        count: sourceFilteredAttempts.filter((attempt) => attempt.weakestArea === 'detection stability').length,
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
            <h2>Loading attempts</h2>
            <p>Refreshing the archive and latest scoring results.</p>
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
            <h2>Could not load the attempt archive</h2>
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
          <span className="hero__eyebrow">ARCHIVE / ATTEMPT LOG</span>
          <h2>Compare prepared records, sample previews, and real upload results in one place</h2>
          <p>
            This view keeps the scoring archive readable while showing which attempts still need processing follow-up.
          </p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/challenges">
              Open challenge list
            </Link>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift">
              <span>TOTAL</span>
              <strong>{String(attempts.length).padStart(2, '0')}</strong>
              <p>All saved attempts</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>DONE</span>
              <strong>{String(counts.completed).padStart(2, '0')}</strong>
              <p>Completed results</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>READY</span>
              <strong>{String(counts.prepared).padStart(2, '0')}</strong>
              <p>Prepared only</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>LIVE</span>
              <strong>{String(counts.autoscored).padStart(2, '0')}</strong>
              <p>Auto-scored uploads</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">01</span>
          <div>
            <h2>Archive summary</h2>
            <p>See how many attempts came from real uploads, prepared placeholders, and sample previews.</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card stat-card--accent panel-lift panel-lift--accent">
            <strong>Auto-scored uploads</strong>
            <p>{counts.autoscored} items</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>Sample previews</strong>
            <p>{counts.sample} items</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>Prepared only</strong>
            <p>{counts.preparedSource} items</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>Needs attention</strong>
            <p>{counts.attention} items</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('pose similarity')} weak</strong>
            <p>{counts.weakPose} items</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('timing')} weak</strong>
            <p>{counts.weakTiming} items</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>{toAttemptBreakdownLabel('detection stability')} weak</strong>
            <p>{counts.weakStability} items</p>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">02</span>
          <div>
            <h2>Processing filter</h2>
            <p>Switch between inline results, async pending uploads, and prototype-style entries.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'ALL', label: 'All', count: attempts.length },
            { key: 'SYNC_INLINE', label: 'Inline processing', count: counts.syncInline },
            { key: 'ASYNC_JOB_PENDING', label: 'Async pending', count: counts.asyncPending },
            { key: 'PROTOTYPE', label: 'Prototype/default', count: counts.prototype },
            { key: 'ATTENTION', label: 'Needs attention', count: counts.attention },
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
          Showing <strong>{processingFilteredAttempts.length}</strong> attempts filtered by{' '}
          <strong>{processingFilterLabel(activeFilter)}</strong>.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">03</span>
          <div>
            <h2>Result source filter</h2>
            <p>Separate real upload scoring from previews and prepared-only records.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'ALL', label: 'All sources', count: processingFilteredAttempts.length },
            {
              key: 'VIDEO_UPLOAD_AUTOSCORED',
              label: 'Auto-scored upload',
              count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED')
                .length,
            },
            {
              key: 'SAMPLE_SCORING_PREVIEW',
              label: 'Sample preview',
              count: processingFilteredAttempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW')
                .length,
            },
            {
              key: 'PREPARED_FLOW',
              label: 'Prepared flow',
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
          Source filter <strong>{sourceFilterLabel(activeSourceFilter)}</strong> is showing{' '}
          <strong>{sourceFilteredAttempts.length}</strong> attempts.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">04</span>
          <div>
            <h2>Weakness filter</h2>
            <p>Focus on attempts that need the most work in pose, timing, or detection stability.</p>
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
          Weakness filter <strong>{weaknessFilterLabel(activeWeaknessFilter)}</strong> is showing{' '}
          <strong>{weaknessFilteredAttempts.length}</strong> attempts.
        </p>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">05</span>
          <div>
            <h2>Challenge focus</h2>
            <p>Jump into the most retried challenges and compare the latest runs together.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          <button
            type="button"
            className={`archive-filter ${activeChallengeFilter === 'ALL' ? 'archive-filter--active' : ''}`}
            onClick={() => setActiveChallengeFilter('ALL')}
          >
            <span>All challenges</span>
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
          Challenge focus <strong>{challengeFilterLabel(activeChallengeFilter, challengeFocusOptions)}</strong> is showing{' '}
          <strong>{challengeFilteredAttempts.length}</strong> attempts.
        </p>
        {activeChallengeMeta ? (
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${activeChallengeMeta.challengeId}`}>
              Open challenge detail
            </Link>
            <Link className="button-link button-link--secondary" to={`/challenges/${activeChallengeMeta.challengeId}/start`}>
              Retry this challenge
            </Link>
          </div>
        ) : null}
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">06</span>
          <div>
            <h2>Sort results</h2>
            <p>Reorder the filtered attempts by recency or by score to compare retries faster.</p>
          </div>
        </div>
        <div className="archive-filter-group">
          {[
            { key: 'RECENT', label: 'Newest first' },
            { key: 'OLDEST', label: 'Oldest first' },
            { key: 'SCORE_HIGH', label: 'Highest score' },
            { key: 'SCORE_LOW', label: 'Lowest score' },
            { key: 'MOST_IMPROVED', label: 'Most improved' },
            { key: 'MOST_DROPPED', label: 'Most dropped' },
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
          Sort order <strong>{sortLabel(activeSort)}</strong> is applied to <strong>{filteredAttempts.length}</strong> attempts.
        </p>
      </section>

      {filteredAttempts.length === 0 ? (
        <section className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">EMPTY</span>
            <div>
              <h2>No attempts match the current filters</h2>
              <p>Change the filters or create a new challenge attempt first.</p>
            </div>
          </div>
        </section>
      ) : (
        <AttemptHistoryList attempts={filteredAttempts} comparisonDeltaByAttemptId={comparisonDeltaRecord} />
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
      return 'inline processing';
    case 'ASYNC_JOB_PENDING':
      return 'async pending';
    case 'PROTOTYPE':
      return 'prototype/default';
    case 'ATTENTION':
      return 'needs attention';
    default:
      return 'all processing modes';
  }
}

function sourceFilterLabel(filter: AttemptSourceFilter) {
  switch (filter) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return 'auto-scored upload';
    case 'SAMPLE_SCORING_PREVIEW':
      return 'sample preview';
    case 'PREPARED_FLOW':
      return 'prepared flow';
    default:
      return 'all sources';
  }
}

function weaknessFilterLabel(filter: AttemptWeaknessFilter) {
  if (filter === 'ALL') {
    return 'all weakness areas';
  }

  return toAttemptBreakdownLabel(filter);
}

function challengeFilterLabel(
  filter: AttemptChallengeFilter,
  options: { challengeId: number; challengeTitle: string; count: number; latestAttemptedAt: string }[],
) {
  if (filter === 'ALL') {
    return 'all challenges';
  }

  return options.find((option) => option.challengeId === filter)?.challengeTitle ?? `challenge #${filter}`;
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
      return 'oldest first';
    case 'SCORE_HIGH':
      return 'highest score first';
    case 'SCORE_LOW':
      return 'lowest score first';
    case 'MOST_IMPROVED':
      return 'largest score gain first';
    case 'MOST_DROPPED':
      return 'largest score drop first';
    case 'RECENT':
    default:
      return 'newest first';
  }
}
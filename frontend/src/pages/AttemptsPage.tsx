import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

    return { completed, prepared, autoscored, sample, preparedSource, syncInline, asyncPending, attention, prototype };
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

  const filteredAttempts = useMemo(() => {
    if (activeSourceFilter === 'ALL') {
      return processingFilteredAttempts;
    }
    return processingFilteredAttempts.filter((attempt) => attempt.resultSource === activeSourceFilter);
  }, [activeSourceFilter, processingFilteredAttempts]);

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
          <strong>{filteredAttempts.length}</strong> attempts.
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
        <AttemptHistoryList attempts={filteredAttempts} />
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

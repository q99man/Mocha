import { useEffect, useMemo, useState } from 'react';
import { ChallengeCard } from '../features/challenges/ChallengeCard';
import { getChallenges } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

type ChallengeFilter = 'ALL' | 'READY' | 'SCORED' | 'NEW';
type ChallengeSort = 'TITLE' | 'READY_FIRST' | 'RECENT_SCORE' | 'BEST_IMPROVEMENT';

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [activeSort, setActiveSort] = useState<ChallengeSort>('READY_FIRST');

  useEffect(() => {
    let active = true;
    async function loadChallenges() {
      setLoading(true);
      setError(null);
      try {
        const challengeResponse = await getChallenges();
        if (active) {
          setChallenges(challengeResponse);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the challenge library.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadChallenges();
    return () => { active = false; };
  }, []);

  const readyCount = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady).length;
  const scoredChallengeCount = challenges.filter((challenge) => challenge.latestRetrySummary).length;

  const filteredChallenges = useMemo(() => {
    const matchesFilter = (challenge: Challenge) => {
      const ready = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
      const scored = !!challenge.latestRetrySummary;
      return activeFilter === 'READY' ? ready : activeFilter === 'SCORED' ? scored : activeFilter === 'NEW' ? !scored : true;
    };

    const sortRank = (challenge: Challenge) => {
      const retrySummary = challenge.latestRetrySummary;
      const ready = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
      return activeSort === 'RECENT_SCORE'
        ? retrySummary ? Date.parse(retrySummary.latestAttemptedAt) : -1
        : activeSort === 'BEST_IMPROVEMENT'
          ? retrySummary?.scoreDeltaFromPrevious ?? Number.NEGATIVE_INFINITY
          : activeSort === 'READY_FIRST'
            ? ready ? 1 : 0
            : 0;
    };

    return challenges.filter(matchesFilter).sort((left, right) => {
      if (activeSort === 'TITLE') {
        return left.title.localeCompare(right.title, 'ko-KR');
      }
      const rightRank = sortRank(right);
      const leftRank = sortRank(left);
      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }
      return left.title.localeCompare(right.title, 'ko-KR');
    });
  }, [activeFilter, activeSort, challenges]);

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">TRACK SELECT / CHALLENGE LIBRARY</span>
          <h2>Choose the next challenge with readiness and retry context visible from the start</h2>
          <p>Browse challenge metadata, reference readiness, and recent scored retry signals in one place.</p>
        </div>
        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item"><span>TOTAL</span><strong>{String(challenges.length).padStart(2, '0')}</strong><p>Loaded challenges</p></div>
            <div className="signal-grid__item"><span>READY</span><strong>{String(readyCount).padStart(2, '0')}</strong><p>Ready for live scoring</p></div>
            <div className="signal-grid__item"><span>SCORED</span><strong>{String(scoredChallengeCount).padStart(2, '0')}</strong><p>Challenges with scored history</p></div>
          </div>
        </div>
      </section>

      {!loading && !error && challenges.length > 0 ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">FILTER</span>
            <div>
              <h2>Challenge filters</h2>
              <p>Switch between ready items, challenges with scored history, and fresh challenges without a baseline yet.</p>
            </div>
          </div>
          <div className="archive-filter-group">
            {FILTER_OPTIONS.map((option) => {
              const isActive = option.value === activeFilter;
              return (
                <button key={option.value} className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`} type="button" onClick={() => setActiveFilter(option.value)}>
                  <span>{option.label}</span>
                  <strong>{option.summary}</strong>
                </button>
              );
            })}
          </div>
          <p className="archive-filter__summary">{buildChallengeFilterSummary(activeFilter, filteredChallenges.length)}</p>
          <label className="attempts-page__select challenge-page__sort">
            <span>Sort challenges</span>
            <select value={activeSort} onChange={(event) => setActiveSort(event.target.value as ChallengeSort)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      {loading ? <section className="panel panel--section"><div className="section-heading"><span className="section-heading__code">LOADING</span><div><h2>Loading challenge library</h2><p>Collecting challenge metadata and retry summaries.</p></div></div></section> : null}
      {error ? <section className="panel panel--error panel--section"><div className="section-heading"><span className="section-heading__code">ERROR</span><div><h2>Could not load the challenge library</h2><p>{error}</p></div></div></section> : null}
      {!loading && !error && challenges.length === 0 ? <section className="panel panel--section"><div className="section-heading"><span className="section-heading__code">EMPTY</span><div><h2>No challenges are registered yet</h2><p>Create a challenge with a reference video from the admin console first.</p></div></div></section> : null}
      {!loading && !error && challenges.length > 0 && filteredChallenges.length === 0 ? <section className="panel panel--section"><div className="section-heading"><span className="section-heading__code">NO MATCH</span><div><h2>No challenges match the current filter</h2><p>Try another filter or create more scored history to populate this view.</p></div></div></section> : null}
      {!loading && !error && filteredChallenges.length > 0 ? <section className="grid grid--cards">{filteredChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)}</section> : null}
    </div>
  );
}

const FILTER_OPTIONS: { value: ChallengeFilter; label: string; summary: string }[] = [
  { value: 'ALL', label: 'All challenges', summary: 'Everything' },
  { value: 'READY', label: 'Ready to upload', summary: 'Ready' },
  { value: 'SCORED', label: 'Has scored history', summary: 'Scored' },
  { value: 'NEW', label: 'No scored history yet', summary: 'New' },
];
const SORT_OPTIONS: { value: ChallengeSort; label: string }[] = [
  { value: 'READY_FIRST', label: 'Ready first' },
  { value: 'RECENT_SCORE', label: 'Most recent scored run' },
  { value: 'BEST_IMPROVEMENT', label: 'Best improvement' },
  { value: 'TITLE', label: 'Title' },
];
function buildChallengeFilterSummary(filter: ChallengeFilter, count: number) { return filter === 'READY' ? `Showing ${count} challenges that are ready for live upload scoring.` : filter === 'SCORED' ? `Showing ${count} challenges that already have scored retry history.` : filter === 'NEW' ? `Showing ${count} challenges that still need their first scored baseline.` : `Showing ${count} challenges across the full library.`; }
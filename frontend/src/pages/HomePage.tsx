import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChallenges } from '../shared/api/challengeApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import type { Challenge } from '../shared/types/challenge';

type RetrySpotlight = { challenge: Challenge; delta: number | null };

export function HomePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadHomeSignals() {
      setLoading(true);
      try {
        const challengeResponse = await getChallenges().catch(() => []);
        if (active) {
          setChallenges(challengeResponse);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadHomeSignals();
    return () => { active = false; };
  }, []);

  const retrySpotlights = useMemo(() => {
    return challenges
      .filter((challenge) => challenge.latestRetrySummary)
      .map((challenge) => ({
        challenge,
        delta: challenge.latestRetrySummary?.scoreDeltaFromPrevious ?? null,
      }))
      .sort(
        (left, right) =>
          Date.parse(right.challenge.latestRetrySummary?.latestAttemptedAt ?? '') -
          Date.parse(left.challenge.latestRetrySummary?.latestAttemptedAt ?? ''),
      );
  }, [challenges]);

  const recentSpotlight = retrySpotlights[0] ?? null;
  const topImprovement = useMemo(
    () =>
      retrySpotlights
        .filter((item) => item.delta != null && item.delta > 0)
        .sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0] ?? null,
    [retrySpotlights],
  );
  const readyCount = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady).length;
  const scoredCount = retrySpotlights.length;

  return (
    <div className="page">
      <section className="hero hero--stage">
        <div className="hero__content">
          <span className="hero__eyebrow">STAGE ENTRY / WEB MVP</span>
          <h2>Select a challenge, verify the setup, and review scored retries from one motion console</h2>
          <p>Mocha is a lightweight web console for browsing motion challenges, uploading real attempts, and comparing retry results in a single flow.</p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">Open challenge library</Link>
            <Link className="button-link button-link--secondary" to="/attempts">Open archive</Link>
          </div>
        </div>
        <div className="hero__aside hero__aside--stage">
          <div className="signal-panel panel-lift panel-lift--accent">
            <span className="signal-panel__label">SYSTEM STATUS</span>
            <strong>{loading ? 'SYNCING LIVE SIGNALS' : 'CHALLENGE FLOW READY'}</strong>
            <p>The home page, challenge flow, results, and archive now share the same retry story.</p>
          </div>
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift"><span>CHALLENGES</span><strong>{String(challenges.length).padStart(2, '0')}</strong><p>Loaded challenges</p></div>
            <div className="signal-grid__item panel-lift"><span>READY</span><strong>{String(readyCount).padStart(2, '0')}</strong><p>Ready for live upload scoring</p></div>
            <div className="signal-grid__item panel-lift"><span>SCORED</span><strong>{String(scoredCount).padStart(2, '0')}</strong><p>Challenges with scored history</p></div>
            <div className="signal-grid__item panel-lift"><span>LIVE</span><strong>{loading ? '--' : 'SYNC'}</strong><p>Challenge summaries now include retry context</p></div>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift home-spotlight">
        <div className="section-heading">
          <span className="section-heading__code">01</span>
          <div>
            <h2>Retry spotlight</h2>
            <p>See the most recent scored run and the biggest improvement without opening another page first.</p>
          </div>
        </div>
        <div className="dashboard-grid home-spotlight__grid">
          <article className="panel panel--section home-spotlight__card">
            <span className="home-spotlight__label">Most recent scored run</span>
            {recentSpotlight && recentSpotlight.challenge.latestRetrySummary ? (
              <>
                <strong>{recentSpotlight.challenge.title}</strong>
                <p>{recentSpotlight.challenge.latestRetrySummary.latestScore} pts / {formatDelta(recentSpotlight.delta)}</p>
                <p>
                  {recentSpotlight.challenge.latestRetrySummary.retryFocus ??
                    (recentSpotlight.challenge.latestRetrySummary.weakestArea
                      ? `Watch ${toAttemptBreakdownLabel(recentSpotlight.challenge.latestRetrySummary.weakestArea)} before the next retry.`
                      : 'Open the latest result and review the breakdown before recording again.')}
                </p>
                <div className="inline-actions">
                  <Link className="button-link button-link--secondary" to={`/attempts/${recentSpotlight.challenge.latestRetrySummary.latestAttemptId}/result`}>
                    Open latest result
                  </Link>
                  <Link className="button-link button-link--secondary" to={`/challenges/${recentSpotlight.challenge.id}/start`}>
                    Retry now
                  </Link>
                </div>
              </>
            ) : (
              <>
                <strong>No scored runs yet</strong>
                <p>The first auto-scored upload will appear here as soon as the first real comparison is saved.</p>
              </>
            )}
          </article>

          <article className="panel panel--section home-spotlight__card">
            <span className="home-spotlight__label">Best improvement</span>
            {topImprovement && topImprovement.challenge.latestRetrySummary ? (
              <>
                <strong>{topImprovement.challenge.title}</strong>
                <p>{formatDelta(topImprovement.delta)} / latest {topImprovement.challenge.latestRetrySummary.latestScore} pts</p>
                <p>
                  {topImprovement.challenge.latestRetrySummary.keepStableFocus ??
                    (topImprovement.challenge.latestRetrySummary.strongestArea
                      ? `${toAttemptBreakdownLabel(topImprovement.challenge.latestRetrySummary.strongestArea)} stayed stable in the last retry.`
                      : 'Open the result page for the full comparison and strongest-area detail.')}
                </p>
                <div className="inline-actions">
                  <Link className="button-link button-link--secondary" to={`/challenges/${topImprovement.challenge.id}`}>
                    Open challenge detail
                  </Link>
                  <Link className="button-link button-link--secondary" to="/attempts">
                    Open archive
                  </Link>
                </div>
              </>
            ) : (
              <>
                <strong>No improvement trend yet</strong>
                <p>As soon as a challenge has two scored runs, the biggest score gain will appear here.</p>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">02</span>
          <div>
            <h2>Current focus</h2>
            <p>This MVP is now centered on the retry loop rather than on a one-time demo path.</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card stat-card--accent panel-lift panel-lift--accent"><strong>Challenge discovery</strong><p>Browse challenge metadata, readiness, and retry context before choosing where to go next.</p></div>
          <div className="stat-card panel-lift"><strong>Live upload flow</strong><p>Move from the start console into a real scored upload without switching to a separate prototype path.</p></div>
          <div className="stat-card panel-lift"><strong>Retry comparison</strong><p>Review score deltas, breakdowns, and coaching hints across result pages and archive cards.</p></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section panel-lift">
          <div className="section-heading"><span className="section-heading__code">03</span><div><h2>Recommended path</h2><p>The most useful flow now starts by reviewing the latest retry and then moving back into the same challenge.</p></div></div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. Check the home spotlight for the latest scored run or best improvement</div>
            <div className="detail-flow__item">2. Open the challenge detail or start console for the same challenge</div>
            <div className="detail-flow__item">3. Upload a fresh attempt with the same setup</div>
            <div className="detail-flow__item">4. Compare score delta, breakdown, and coaching on the result page</div>
          </div>
        </article>

        <article className="panel panel--section panel-lift">
          <div className="section-heading"><span className="section-heading__code">04</span><div><h2>Next completeness target</h2><p>The next step is to turn the collected retry signals into even stronger coaching and guidance.</p></div></div>
          <ul className="detail-list">
            <li><strong>Retry continuity</strong>Keep the same challenge context visible across home, list, detail, start, result, and archive.</li>
            <li><strong>Coaching quality</strong>Turn weak-area and score-delta signals into clearer capture advice for the next retry.</li>
            <li><strong>Operational clarity</strong>Keep the model, reference, and scored-run state readable from the UI without hidden assumptions.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

function formatDelta(delta: number | null) {
  return delta == null ? 'Baseline' : delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta} pts`;
}
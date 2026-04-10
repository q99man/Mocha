import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CameraPermissionPanel } from '../features/motion/CameraPermissionPanel';
import { getChallengeById } from '../shared/api/challengeApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import type { Challenge, ChallengeBreakdownArea } from '../shared/types/challenge';

export function ChallengeStartPage() {
  const { id = '' } = useParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadChallenge() {
      setLoading(true);
      setError(null);

      try {
        const challengeResponse = await getChallengeById(id);
        if (active) {
          setChallenge(challengeResponse);
        }
      } catch (loadError) {
        if (active) {
          setChallenge(null);
          setError(loadError instanceof Error ? loadError.message : 'Could not load the challenge start console.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenge();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">LOADING</span>
          <div>
            <h2>Loading the challenge start console</h2>
            <p>Checking camera flow, upload flow, and retry context.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">ERROR</span>
          <div>
            <h2>Could not open the challenge start console</h2>
            <p>{error ?? 'The selected challenge could not be found.'}</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          Back to challenge list
        </Link>
      </section>
    );
  }

  const challengeReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
  const recentRetry = challenge.latestRetrySummary;

  if (!challengeReady) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">LOCK</span>
          <div>
            <h2>This challenge is not ready for live attempts yet</h2>
            <p>Only challenges with a real reference video and a ready motion profile can accept scored uploads.</p>
          </div>
        </div>

        <ul className="detail-list">
          <li>
            <strong>Reference video</strong>
            {challenge.referenceVideoUploaded ? 'Uploaded' : 'Missing'}
          </li>
          <li>
            <strong>Motion profile</strong>
            {challenge.referenceMotionProfileReady ? 'Ready' : 'Pending'}
          </li>
          <li>
            <strong>Analysis status</strong>
            {challenge.referenceAnalysisStatus}
          </li>
        </ul>

        <div className="inline-actions">
          <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
            Open challenge detail
          </Link>
          <Link className="button-link button-link--secondary" to="/admin/model-assets">
            Open admin console
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">START CONSOLE / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>Use this screen to check device access, upload a real attempt video, and move directly into the scored result flow.</p>

          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}s</span>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>REFERENCE</span>
              <strong>{analysisStatusLabel(challenge.referenceAnalysisStatus)}</strong>
              <p>Reference analysis state</p>
            </div>
            <div className="signal-grid__item">
              <span>SCORING</span>
              <strong>READY</strong>
              <p>Live upload scoring is available</p>
            </div>
            <div className="signal-grid__item">
              <span>LAST SCORE</span>
              <strong>{recentRetry ? `${recentRetry.latestScore} pts` : 'NONE'}</strong>
              <p>{buildLastScoreCaption(recentRetry?.scoreDeltaFromPrevious ?? null, !!recentRetry)}</p>
            </div>
          </div>

          <div className="signal-panel">
            <span className="signal-panel__label">FLOW GUIDE</span>
            <strong>Check access / upload / review result</strong>
            <p>This console is focused on the real upload scoring loop, not prototype-only flows.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>What you can do here</h2>
              <p>Move from setup into a real scored upload without leaving the page.</p>
            </div>
          </div>

          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. Check camera permission and device access</div>
            <div className="detail-flow__item">2. Upload a real attempt video</div>
            <div className="detail-flow__item">3. Open the result page and review the score breakdown</div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>Current readiness</h2>
              <p>This challenge already has a real reference video and a completed motion profile.</p>
            </div>
          </div>

          <ul className="detail-list">
            <li>
              <strong>Reference analysis</strong>
              {analysisStatusDescription(challenge.referenceAnalysisStatus)}
            </li>
            <li>
              <strong>Motion profile</strong>
              Ready. The backend can compare new uploads against the reference profile.
            </li>
            <li>
              <strong>Best next step</strong>
              Keep the same camera setup and upload a fresh attempt so the next score shift is easier to read.
            </li>
          </ul>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              Back to challenge detail
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              Open challenge archive
            </Link>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--retry">
        <article className="panel panel--section challenge-start__retry-panel">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>Latest retry snapshot</h2>
              <p>Check the latest auto-scored attempt before you upload a new run.</p>
            </div>
          </div>

          {recentRetry ? (
            <>
              <div className="challenge-start__retry-summary">
                <div>
                  <span>Latest score</span>
                  <strong>{recentRetry.latestScore} pts</strong>
                </div>
                <div>
                  <span>Trend</span>
                  <strong className={buildDeltaToneClass(recentRetry.scoreDeltaFromPrevious)}>
                    {formatDelta(recentRetry.scoreDeltaFromPrevious)}
                  </strong>
                </div>
                <div>
                  <span>Weak area</span>
                  <strong>
                    {recentRetry.weakestArea ? toAttemptBreakdownLabel(recentRetry.weakestArea) : 'Not enough data'}
                  </strong>
                </div>
              </div>

              <ul className="detail-list challenge-start__retry-list">
                <li>
                  <strong>Retry note</strong>
                  {buildRetryNote(recentRetry.retryFocus, recentRetry.weakestArea)}
                </li>
                <li>
                  <strong>Keep stable</strong>
                  {buildKeepStableNote(recentRetry.keepStableFocus, recentRetry.strongestArea)}
                </li>
                <li>
                  <strong>Teaser</strong>
                  {recentRetry.coachingTeaser ?? 'Open the result page for the full retry comparison.'}
                </li>
                <li>
                  <strong>Last recorded</strong>
                  {formatAttemptedAt(recentRetry.latestAttemptedAt)}
                </li>
              </ul>

              <div className="inline-actions">
                <Link className="button-link button-link--secondary" to={`/attempts/${recentRetry.latestAttemptId}/result`}>
                  Open latest result
                </Link>
                <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
                  Open challenge archive
                </Link>
              </div>
            </>
          ) : (
            <div className="challenge-start__empty-state">
              <strong>No auto-scored attempt exists for this challenge yet.</strong>
              <p>The first live upload will become the baseline for every retry after this one.</p>
            </div>
          )}
        </article>
      </section>

      <CameraPermissionPanel challengeId={challenge.id} challengeTitle={challenge.title} />
    </div>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return 'READY';
    case 'ANALYZING':
      return 'RUN';
    case 'FAILED':
      return 'FAIL';
    default:
      return 'WAIT';
  }
}

function analysisStatusDescription(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return 'Reference analysis is complete and the scoring pipeline is ready.';
    case 'ANALYZING':
      return 'Reference analysis is still running. Wait for the profile to finish before scoring new uploads.';
    case 'FAILED':
      return 'Reference analysis failed. Re-run the analysis from the admin console.';
    default:
      return 'Reference analysis has not started yet.';
  }
}

function buildLastScoreCaption(delta: number | null, hasRetry: boolean) {
  if (!hasRetry) {
    return 'No auto-scored retry has been saved yet';
  }
  if (delta == null) {
    return 'The first scored run is saved as the baseline';
  }
  if (delta > 0) {
    return `${delta} pts higher than the previous retry`;
  }
  if (delta < 0) {
    return `${Math.abs(delta)} pts lower than the previous retry`;
  }
  return 'The latest retry matched the previous score';
}

function buildRetryNote(retryFocus: string | null, weakestArea: ChallengeBreakdownArea | null) {
  if (retryFocus) {
    return retryFocus;
  }
  if (weakestArea) {
    return `Focus on ${toAttemptBreakdownLabel(weakestArea)} first so the next retry has a clearer improvement target.`;
  }
  return 'Keep the setup stable and capture one more retry.';
}

function buildKeepStableNote(keepStableFocus: string | null, strongestArea: ChallengeBreakdownArea | null) {
  if (keepStableFocus) {
    return keepStableFocus;
  }
  if (strongestArea) {
    return `Keep ${toAttemptBreakdownLabel(strongestArea)} stable so the next retry does not lose its strongest signal.`;
  }
  return 'Keep the camera setup and pacing as steady as possible so the next retry is easy to compare.';
}

function buildDeltaToneClass(delta: number | null) {
  if (delta == null || delta === 0) {
    return '';
  }
  return delta > 0 ? 'challenge-start__trend challenge-start__trend--up' : 'challenge-start__trend challenge-start__trend--down';
}

function formatDelta(delta: number | null) {
  if (delta == null) {
    return 'Baseline';
  }
  if (delta === 0) {
    return 'No change';
  }
  return `${delta > 0 ? '+' : ''}${delta} pts`;
}

function formatAttemptedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

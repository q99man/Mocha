import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getChallengeById } from '../shared/api/challengeApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import type { Challenge, ChallengeBreakdownArea } from '../shared/types/challenge';

export function ChallengeDetailPage() {
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
          setError(loadError instanceof Error ? loadError.message : 'Could not load the challenge detail page.');
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
            <h2>Loading challenge detail</h2>
            <p>Collecting reference readiness and recent retry signals.</p>
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
            <h2>Could not load the challenge detail</h2>
            <p>{error}</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          Back to challenge list
        </Link>
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">EMPTY</span>
          <div>
            <h2>Challenge not found</h2>
            <p>The selected challenge does not exist or is no longer active.</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          Back to challenge list
        </Link>
      </section>
    );
  }

  const recentRetry = challenge.latestRetrySummary;

  return (
    <div className="page">
      <section className="hero hero--detail">
        <div className="hero__media">
          {challenge.thumbnailUrl ? (
            <img className="hero__image" src={challenge.thumbnailUrl} alt={challenge.title} />
          ) : (
            <div className="hero__image hero__image--placeholder">VISUAL READY SOON</div>
          )}
        </div>

        <div className="hero__content">
          <span className="hero__eyebrow">TRACK DETAIL / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>

          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}s track</span>
          </div>

          <div className="signal-panel">
            <span className="signal-panel__label">READY STATUS</span>
            <strong>{readyHeadline(challenge)}</strong>
            <p>{readyDescription(challenge)}</p>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              Start challenge
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              Open challenge archive
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>Reference readiness</h2>
              <p>Check whether the challenge is ready for real upload scoring.</p>
            </div>
          </div>

          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>ANALYSIS</span>
              <strong>{analysisShortLabel(challenge.referenceAnalysisStatus)}</strong>
              <p>{analysisStatusLabel(challenge.referenceAnalysisStatus)}</p>
            </div>
            <div className="signal-grid__item">
              <span>REFERENCE</span>
              <strong>{challenge.referenceVideoUploaded ? 'UP' : 'WAIT'}</strong>
              <p>{challenge.referenceVideoUploaded ? 'Reference video uploaded' : 'Reference video missing'}</p>
            </div>
            <div className="signal-grid__item">
              <span>PROFILE</span>
              <strong>{challenge.referenceMotionProfileReady ? 'READY' : 'PENDING'}</strong>
              <p>{challenge.referenceMotionProfileReady ? 'Motion profile ready' : 'Waiting for profile generation'}</p>
            </div>
            <div className="signal-grid__item">
              <span>LAST SCAN</span>
              <strong>{challenge.referenceAnalyzedAt ? 'LOGGED' : 'NONE'}</strong>
              <p>
                {challenge.referenceAnalyzedAt
                  ? new Date(challenge.referenceAnalyzedAt).toLocaleString('ko-KR')
                  : 'No analysis history yet'}
              </p>
            </div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>Entry guide</h2>
              <p>Use this sequence to move from detail view into a fresh scored retry.</p>
            </div>
          </div>

          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. Confirm reference readiness and the latest retry trend</div>
            <div className="detail-flow__item">2. Open the start console and choose the upload path</div>
            <div className="detail-flow__item">3. Review the result page and compare against the previous scored run</div>
          </div>

          <ul className="detail-list">
            <li>
              <strong>Guide video</strong>
              {challenge.guideVideoUrl
                ? 'A guide video is linked, so you can review the target move before recording again.'
                : 'No guide video is linked, but the reference readiness and retry history are still available.'}
            </li>
            <li>
              <strong>Recommended next step</strong>
              {challenge.referenceMotionProfileReady
                ? 'Open the start console and test another live upload with the same framing.'
                : 'Finish the reference analysis in the admin console before attempting a real comparison.'}
            </li>
          </ul>

          {challenge.guideVideoUrl ? (
            <a className="button-link button-link--secondary" href={challenge.guideVideoUrl} target="_blank" rel="noreferrer">
              Open guide video
            </a>
          ) : null}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--retry">
        <article className="panel panel--section challenge-start__retry-panel">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>Recent retry flow</h2>
              <p>Review the latest auto-scored result for this challenge before starting another attempt.</p>
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
                  {recentRetry.coachingTeaser ?? 'Open the latest result for the full comparison summary.'}
                </li>
                <li>
                  <strong>Latest result</strong>
                  {formatAttemptedAt(recentRetry.latestAttemptedAt)}
                </li>
              </ul>

              <div className="inline-actions">
                <Link className="button-link button-link--secondary" to={`/attempts/${recentRetry.latestAttemptId}/result`}>
                  Open latest result
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}/start`}>
                  Retry this challenge
                </Link>
              </div>
            </>
          ) : (
            <div className="challenge-start__empty-state">
              <strong>No auto-scored history exists for this challenge yet.</strong>
              <p>The first live upload will become the baseline for future retries.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') {
    return 'Reference analysis complete';
  }
  if (status === 'ANALYZING') {
    return 'Reference analysis running';
  }
  if (status === 'FAILED') {
    return 'Reference analysis failed';
  }
  return 'Reference analysis pending';
}

function analysisShortLabel(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') {
    return 'READY';
  }
  if (status === 'ANALYZING') {
    return 'SCAN';
  }
  if (status === 'FAILED') {
    return 'ERROR';
  }
  return 'WAIT';
}

function readyHeadline(challenge: Challenge) {
  if (challenge.referenceMotionProfileReady) {
    return 'This challenge is ready for real upload scoring.';
  }
  if (challenge.referenceVideoUploaded) {
    return 'The reference video is uploaded, but scoring stays limited until analysis finishes.';
  }
  return 'Reference setup still needs work before this challenge is fully ready.';
}

function readyDescription(challenge: Challenge) {
  if (challenge.referenceMotionProfileReady) {
    return 'Open the start console to upload a real attempt and compare it against the saved reference profile.';
  }
  return 'You can review metadata now, but meaningful scoring starts only after the reference profile is ready.';
}

function buildRetryNote(retryFocus: string | null, weakestArea: ChallengeBreakdownArea | null) {
  if (retryFocus) {
    return retryFocus;
  }
  if (weakestArea) {
    return `Focus on ${toAttemptBreakdownLabel(weakestArea)} first so the next retry has a clearer target.`;
  }
  return 'The latest result has limited guidance data. Keep the setup steady and capture one more retry.';
}

function buildKeepStableNote(keepStableFocus: string | null, strongestArea: ChallengeBreakdownArea | null) {
  if (keepStableFocus) {
    return keepStableFocus;
  }
  if (strongestArea) {
    return `Keep ${toAttemptBreakdownLabel(strongestArea)} stable so the next retry does not lose its strongest signal.`;
  }
  return 'Keep the setup steady and avoid changing framing, pacing, and distance all at once.';
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

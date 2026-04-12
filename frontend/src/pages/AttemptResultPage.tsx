import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getAttemptById,
  getAttemptVideoProcessingProgressByTrackingId,
} from '../shared/api/attemptApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import {
  buildDurableProgressCalloutTitle,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressNextStep,
  buildDurableProgressRefreshMessage,
  buildDurableProgressSnapshotFromAttempt,
  buildDurableProgressStatusTag,
  buildDurableProgressSummary,
} from '../shared/presentation/durableProgress';
import type {
  AttemptBreakdownArea,
  AttemptProcessingMode,
  AttemptResultSource,
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
} from '../shared/types/attempt';

type ResultMeta = {
  label: string;
  value: string;
};

type InsightCard = {
  title: string;
  body: string;
};

type BreakdownCard = {
  title: string;
  tone: 'strong' | 'warn' | 'neutral';
  badge: string;
  body: string;
};

type CoachingCard = {
  title: string;
  tone: 'accent' | 'warn' | 'neutral';
  body: string;
  checklist: string[];
};

type ChallengeComparisonMetric = {
  label: string;
  delta: number;
};

type ChallengeComparison = {
  previousAttemptId: number;
  previousAttemptedAt: string | null;
  scoreDelta: number;
  summary: string;
  metrics: ChallengeComparisonMetric[];
};

export function AttemptResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<AttemptVideoProcessingJobProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Result id is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAttempt() {
      setLoading(true);
      setError(null);
      setJobProgress(null);
      setProgressMessage(null);
      try {
        const nextAttempt = await getAttemptById(Number(id));
        if (!cancelled) {
          setAttempt(nextAttempt);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the attempt result.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAttempt();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const resultStatusMeta = useMemo(() => buildResultStatusMeta(attempt), [attempt]);
  const scoreStateMeta = useMemo(() => buildScoreStateMeta(attempt), [attempt]);
  const resultSourceMeta = useMemo(() => buildResultSourceMeta(attempt?.resultSource), [attempt?.resultSource]);
  const processingModeMeta = useMemo(() => buildProcessingModeMeta(attempt?.processingMode), [attempt?.processingMode]);
  const processingCompleteMeta = useMemo(
    () => buildProcessingCompleteMeta(attempt?.processingComplete),
    [attempt?.processingComplete],
  );
  const currentStage = useMemo(() => buildCurrentStageSummary(attempt), [attempt]);
  const heroDescription = useMemo(() => buildHeroDescription(attempt), [attempt]);
  const methodologyNote = useMemo(() => buildMethodologyNote(attempt), [attempt]);
  const comparison = useMemo(() => buildChallengeComparison(attempt), [attempt]);
  const insightCards = useMemo(() => buildInsightCards(attempt, comparison), [attempt, comparison]);
  const breakdownCards = useMemo(() => buildBreakdownCards(attempt), [attempt]);
  const coachingCards = useMemo(() => buildCoachingCards(attempt), [attempt]);
  const pendingProcessWarning =
    !!attempt && (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING');
  const effectiveProgress = jobProgress ?? buildDurableProgressSnapshotFromAttempt(attempt);
  const progressResultAttemptId = effectiveProgress?.resultAttemptId ?? null;
  const processFeedToneClass = useMemo(() => buildProcessFeedToneClass(effectiveProgress), [effectiveProgress]);

  async function reloadDurableProgress() {
    if (!attempt?.pendingTrackingId) {
      setProgressMessage('No tracking id is available for this result yet.');
      return;
    }

    setProgressLoading(true);
    setProgressMessage(null);
    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      setJobProgress(progress);
      let nextMessage = buildDurableProgressRefreshMessage(progress);

      if (progress.status === 'COMPLETED') {
        const resolvedAttemptId = progress.resultAttemptId ?? attempt.id;
        if (progress.resultAttemptId != null && progress.resultAttemptId !== attempt.id) {
          setProgressMessage(`Processing completed. Opening result #${progress.resultAttemptId}.`);
          navigate(`/attempts/${progress.resultAttemptId}/result`);
          return;
        }

        const nextAttempt = await getAttemptById(resolvedAttemptId);
        setAttempt(nextAttempt);
        nextMessage =
          progress.resultAttemptId != null && progress.resultAttemptId === attempt.id
            ? `Processing completed. Result #${progress.resultAttemptId} has been refreshed.`
            : 'Processing completed. The latest result details have been refreshed.';
      } else if (progress.status === 'FAILED') {
        const nextAttempt = await getAttemptById(attempt.id);
        setAttempt(nextAttempt);
        nextMessage = `${buildDurableProgressRefreshMessage(progress)} Result details were refreshed.`;
      }

      setProgressMessage(nextMessage);
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : 'Failed to refresh processing status.');
    } finally {
      setProgressLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="result-page">
        <p>Loading result...</p>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="result-page">
        <div className="result-page__hero">
          <p className="result-page__eyebrow">Attempt Result</p>
          <h1>Result unavailable</h1>
          <p>{error ?? 'The requested attempt could not be found.'}</p>
          <div className="result-page__actions">
            <Link to="/attempts" className="button">
              Back to attempts
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="result-page">
      <header className="result-page__hero">
        <div className="result-page__headline-row">
          <div>
            <p className="result-page__eyebrow">Attempt Result</p>
            <h1>{attempt.resultHeadline || 'Attempt result'}</h1>
            <p>{heroDescription}</p>
          </div>
          <div className="result-scoreboard">
            <span className="result-scoreboard__label">score</span>
            <strong>{attempt.scoreAvailable ? attempt.score : '--'}</strong>
            <span className="result-scoreboard__suffix">pts</span>
          </div>
        </div>
        <div className="result-page__actions">
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button">
            Retry this challenge
          </Link>
          <Link to={`/attempts?challengeId=${attempt.challengeId}`} className="button button--secondary">
            Open challenge archive
          </Link>
        </div>
      </header>

      {pendingProcessWarning ? (
        <div className="result-warning-feed">
          <strong>{buildDurableProgressCalloutTitle(effectiveProgress)}</strong>
          <p>
            {buildDurableProgressSummary(effectiveProgress) ??
              attempt.processingNotice ??
              'This result still needs a progress refresh before the final result is ready.'}
          </p>
          {effectiveProgress ? <p>{buildDurableProgressNextStep(effectiveProgress)}</p> : null}
          <div className="inline-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reloadDurableProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? 'Refreshing...' : 'Refresh processing status'}
            </button>
            {progressResultAttemptId ? (
              <Link to={`/attempts/${progressResultAttemptId}/result`} className="button-link">
                Open completed result
              </Link>
            ) : null}
          </div>
          {progressMessage ? <p className="result-page__detail-note">{progressMessage}</p> : null}
        </div>
      ) : null}

      <section className="result-page__status-grid">
        <div className="result-page__status-card">
          <span>{resultStatusMeta.label}</span>
          <strong>{resultStatusMeta.value}</strong>
        </div>
        <div className="result-page__status-card">
          <span>{scoreStateMeta.label}</span>
          <strong>{scoreStateMeta.value}</strong>
        </div>
        <div className="result-page__status-card">
          <span>{resultSourceMeta.label}</span>
          <strong>{resultSourceMeta.value}</strong>
        </div>
        <div className="result-page__status-card">
          <span>{processingModeMeta.label}</span>
          <strong>{processingModeMeta.value}</strong>
        </div>
        <div className="result-page__status-card">
          <span>{processingCompleteMeta.label}</span>
          <strong>{processingCompleteMeta.value}</strong>
        </div>
      </section>

      {comparison ? (
        <section className="result-page__comparison-grid">
          <article className={`result-page__comparison-card result-page__comparison-card--${comparison.scoreDelta >= 0 ? 'good' : 'warn'}`}>
            <span className="result-page__comparison-label">Previous attempt check</span>
            <h2>{comparison.scoreDelta >= 0 ? `+${comparison.scoreDelta} points` : `${comparison.scoreDelta} points`}</h2>
            <p>{comparison.summary}</p>
            {comparison.metrics.length > 0 ? (
              <div className="result-page__comparison-metrics">
                {comparison.metrics.map((metric) => (
                  <span
                    key={metric.label}
                    className={metric.delta >= 0 ? 'result-page__comparison-chip result-page__comparison-chip--good' : 'result-page__comparison-chip result-page__comparison-chip--warn'}
                  >
                    {metric.label} {metric.delta >= 0 ? `+${metric.delta}` : metric.delta}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="result-page__detail-note">
              Compared against attempt #{comparison.previousAttemptId} from {formatAttemptedAt(comparison.previousAttemptedAt ?? null)}.
            </p>
          </article>
        </section>
      ) : null}

      <section className="result-page__breakdown-grid">
        {breakdownCards.map((card) => (
          <article key={card.title} className={`result-breakdown-card result-breakdown-card--${card.tone}`}>
            <span className="result-breakdown-card__badge">{card.badge}</span>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="result-page__insights">
        {insightCards.map((card) => (
          <article key={card.title} className="result-page__insight-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="result-page__coach-grid">
        {coachingCards.map((card) => (
          <article key={card.title} className={`result-page__coach-card result-page__coach-card--${card.tone}`}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
            <ul className="result-page__coach-list">
              {card.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className={`result-process-feed ${processFeedToneClass}`}>
        <strong>How this score was produced</strong>
        <div className="result-process-feed__grid">
          <div>
            <span>Current stage</span>
            <strong>{currentStage}</strong>
          </div>
          <div>
            <span>Analyzer</span>
            <strong>{buildAnalyzerLabel(attempt)}</strong>
          </div>
          <div>
            <span>Score basis</span>
            <strong>Pose similarity + timing + detection stability</strong>
          </div>
          <div>
            <span>Interpretation</span>
            <strong>{methodologyNote}</strong>
          </div>
        </div>
      </section>

      <section className="result-page__detail-grid">
        <article className="result-page__detail-card">
          <h2>Result summary</h2>
          <p>{attempt.resultSummary}</p>
          <p className="result-page__detail-note">{methodologyNote}</p>
          {attempt.processingNotice ? <p className="result-page__detail-note">{attempt.processingNotice}</p> : null}
          {effectiveProgress ? (
            <dl className="result-progress-meta">
              <div>
                <dt>Processing status</dt>
                <dd>{buildProgressStatusLabel(effectiveProgress.status)}</dd>
              </div>
              <div>
                <dt>Completion strategy</dt>
                <dd>{buildDurableProgressCompletionStrategyLabel(effectiveProgress.completionStrategy)}</dd>
              </div>
              <div>
                <dt>Elapsed time</dt>
                <dd>{buildDurableProgressElapsedTimeLabel(effectiveProgress.elapsedSeconds)}</dd>
              </div>
              <div>
                <dt>Original file</dt>
                <dd>{effectiveProgress.originalFileName ?? 'Unknown file'}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className="result-page__detail-card">
          <h2>Attempt details</h2>
          <dl className="result-page__detail-list">
            <div>
              <dt>Attempt id</dt>
              <dd>#{attempt.id}</dd>
            </div>
            <div>
              <dt>Challenge</dt>
              <dd>{attempt.challengeTitle || `Challenge #${attempt.challengeId}`}</dd>
            </div>
            <div>
              <dt>Result source</dt>
              <dd>{resultSourceMeta.value}</dd>
            </div>
            <div>
              <dt>Processing mode</dt>
              <dd>{processingModeMeta.value}</dd>
            </div>
            <div>
              <dt>Strongest area</dt>
              <dd>{attempt.strongestArea ? toAreaLabel(attempt.strongestArea) : 'Waiting for analysis'}</dd>
            </div>
            <div>
              <dt>Weakest area</dt>
              <dd>{attempt.weakestArea ? toAreaLabel(attempt.weakestArea) : 'Waiting for analysis'}</dd>
            </div>
            <div>
              <dt>Uploaded at</dt>
              <dd>{formatAttemptedAt(attempt.attemptedAt)}</dd>
            </div>
            <div>
              <dt>Original file</dt>
              <dd>{attempt.originalFileName ?? 'Unknown file'}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="result-page__actions-grid">
        <article className="result-page__action-card">
          <h3>Retry with the same challenge</h3>
          <p>Keep the reference challenge fixed and adjust only one thing at a time so the score trend is easier to read.</p>
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button button--secondary">
            Go to challenge start
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>Compare from the archive</h3>
          <p>Use the attempts archive to compare this result against older retries, low-score runs, or the same weakness axis.</p>
          <Link to={`/attempts?challengeId=${attempt.challengeId}`} className="button button--secondary">
            Open challenge archive
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>Review challenge setup</h3>
          <p>Check the challenge again if you want to confirm the reference source, runtime state, or model-backed analysis setup.</p>
          <Link to={`/challenges/${attempt.challengeId}`} className="button button--secondary">
            Open challenge details
          </Link>
        </article>
      </section>
    </section>
  );
}

function buildHeroDescription(attempt: AttemptSummary | null) {
  if (!attempt) {
    return 'Preparing result view.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return 'Analysis is still running. Refresh the progress state below to continue once the final result is ready.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'This result comes from a real video upload compared against the saved challenge reference. The score and breakdown use the current analyzer output directly.';
  }

  return 'This is a saved attempt record loaded from the archive.';
}

function buildMethodologyNote(attempt: AttemptSummary | null) {
  if (!attempt) {
    return 'Checking result details.';
  }

  if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'This entry is not a real video-to-reference comparison, so breakdown guidance is limited.';
  }

  return 'The current scoring model combines pose similarity, timing alignment, and detection stability. Camera framing and landmark detection quality can affect all three.';
}

function buildChallengeComparison(attempt: AttemptSummary | null): ChallengeComparison | null {
  if (
    !attempt ||
    attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' ||
    !attempt.scoreAvailable ||
    attempt.previousAttemptId == null ||
    attempt.scoreDeltaFromPrevious == null
  ) {
    return null;
  }

  const metrics = buildComparisonMetrics(attempt);
  const summary =
    attempt.scoreDeltaFromPrevious > 0
      ? `This retry improved over the previous run. ${buildAreaShiftSummary(attempt)}`
      : attempt.scoreDeltaFromPrevious < 0
        ? `This retry scored lower than the previous run. ${buildAreaShiftSummary(attempt)}`
        : `This retry landed on the same score as the previous run. ${buildAreaShiftSummary(attempt)}`;

  return {
    previousAttemptId: attempt.previousAttemptId,
    previousAttemptedAt: attempt.previousAttemptedAt,
    scoreDelta: attempt.scoreDeltaFromPrevious,
    summary,
    metrics,
  };
}

function buildAreaShiftSummary(current: AttemptSummary) {
  if (current.weakestArea) {
    return `${toAreaLabel(current.weakestArea)} is still the clearest place to focus next.`;
  }

  if (current.strongestArea) {
    return `${toAreaLabel(current.strongestArea)} remained the strongest axis in the latest retry.`;
  }

  return 'The analyzer still benefits from another retry with a stable capture setup.';
}

function buildComparisonMetrics(current: AttemptSummary): ChallengeComparisonMetric[] {
  return [
    buildComparisonMetric('Pose', current.poseDeltaFromPrevious),
    buildComparisonMetric('Timing', current.timingDeltaFromPrevious),
    buildComparisonMetric('Stability', current.stabilityDeltaFromPrevious),
  ].filter((metric): metric is ChallengeComparisonMetric => metric !== null);
}

function buildComparisonMetric(label: string, delta: number | null): ChallengeComparisonMetric | null {
  if (delta == null) {
    return null;
  }

  return {
    label,
    delta,
  };
}

function buildMetricDeltaSummary(
  metrics: ChallengeComparisonMetric[],
  mode: 'best' | 'worst',
): ChallengeComparisonMetric | null {
  if (metrics.length === 0) {
    return null;
  }

  const sorted = [...metrics].sort((left, right) => left.delta - right.delta);
  return mode === 'best' ? sorted[sorted.length - 1] : sorted[0];
}

function formatMetricDelta(delta: number) {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function buildInsightCards(attempt: AttemptSummary | null, comparison: ChallengeComparison | null): InsightCard[] {
  if (!attempt) {
    return [];
  }

  const score = attempt.score;
  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const weakestArea = resolveBreakdownArea(attempt, 'weakest');
  const mostImprovedMetric = comparison ? buildMetricDeltaSummary(comparison.metrics, 'best') : null;
  const mostDroppedMetric = comparison ? buildMetricDeltaSummary(comparison.metrics, 'worst') : null;

  const scoreCard: InsightCard = {
    title: 'Score readout',
    body: attempt.scoreAvailable
      ? score >= 90
        ? 'The run is very close to the reference on the current analyzer. This usually means the same clip or a very tightly matched retry.'
        : score >= 75
          ? 'The overall movement is close, but there is still a visible difference in one or two scoring axes.'
          : score >= 55
            ? 'The movement partially matches, but timing, framing, or landmark stability is still pulling the score down.'
            : 'The analyzer sees a clear mismatch compared with the reference. This can come from a different motion, weak detection, or a very different camera setup.'
      : 'The score is not final yet. Refresh processing status once the result finishes.' ,
  };

  const engineCard: InsightCard = {
    title: 'Why the score moved',
    body:
      attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED'
        ? `This result blends pose, timing, and stability together.${strongestArea ? ` The cleanest axis was ${toAreaLabel(strongestArea)}.` : ''}${weakestArea ? ` The biggest drag came from ${toAreaLabel(weakestArea)}.` : ''}`
        : 'This result did not come from a full auto-scored upload, so the explanation is lighter than a real comparison.',
  };

  const nextActionCard: InsightCard = {
    title: 'What changed from the last retry',
    body: comparison
      ? `${mostImprovedMetric ? `${mostImprovedMetric.label} improved the most (${formatMetricDelta(mostImprovedMetric.delta)}). ` : ''}${mostDroppedMetric && mostDroppedMetric.delta < 0 ? `${mostDroppedMetric.label} slipped the most (${formatMetricDelta(mostDroppedMetric.delta)}).` : 'No axis dropped sharply versus the previous retry.'}`
      : 'This is the first scored retry for this challenge, so future runs will compare back to this one.',
  };

  return [scoreCard, engineCard, nextActionCard];
}

function buildCoachingCards(attempt: AttemptSummary | null): CoachingCard[] {
  if (!attempt || attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable) {
    return [
      {
        title: 'Coaching becomes available after scoring',
        tone: 'neutral',
        body: 'Once a real auto-scored upload finishes, this section will turn the breakdown into concrete retry advice.',
        checklist: ['Upload a real challenge video', 'Wait for the final score', 'Open the result again'],
      },
    ];
  }

  const weakestArea = resolveBreakdownArea(attempt, 'weakest');
  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const improvementMetric = buildPrimaryDeltaMetric(attempt, 'best');
  const dropMetric = buildPrimaryDeltaMetric(attempt, 'worst');

  const retryCard: CoachingCard = {
    title: 'Next retry plan',
    tone: weakestArea ? 'warn' : 'accent',
    body: attempt.retryFocus ?? (weakestArea
      ? `${toAreaLabel(weakestArea)} is the fastest place to improve on the next take.${dropMetric && dropMetric.delta < 0 ? ` ${dropMetric.label} also dropped ${formatMetricDelta(dropMetric.delta)} versus the previous retry.` : ''}`
      : 'No single weak axis dominated this result, so keep the whole capture setup consistent on the next take.'),
    checklist: buildRetryChecklist(weakestArea, dropMetric),
  };

  const keepCard: CoachingCard = {
    title: 'What to keep stable',
    tone: 'accent',
    body: attempt.keepStableFocus ?? (strongestArea
      ? `${toAreaLabel(strongestArea)} held up best, so preserve that part while fixing the weaker area.${improvementMetric && improvementMetric.delta > 0 ? ` ${improvementMetric.label} improved ${formatMetricDelta(improvementMetric.delta)} from the last retry.` : ''}`
      : 'The current result does not expose a clear strongest axis yet, so preserve the whole setup across retries.'),
    checklist: buildKeepChecklist(strongestArea, improvementMetric),
  };

  const captureCard: CoachingCard = {
    title: 'Capture checklist',
    tone: 'neutral',
    body:
      attempt.scoreDeltaFromPrevious == null
        ? 'Use the same simple capture checklist on every retry so score changes are easier to interpret.'
        : `This run changed ${attempt.scoreDeltaFromPrevious >= 0 ? 'upward' : 'downward'} by ${formatMetricDelta(attempt.scoreDeltaFromPrevious)} against the previous retry, so keep the capture variables controlled.`,
    checklist: [
      'Keep the whole body visible from head to foot',
      'Match the reference start moment before moving',
      'Avoid heavy backlight or fast camera movement',
    ],
  };

  return [retryCard, keepCard, captureCard];
}

function buildRetryChecklist(weakestArea: AttemptBreakdownArea | null, dropMetric: ChallengeComparisonMetric | null) {
  switch (weakestArea) {
    case 'timing':
      return [
        'Start the move at the same beat or cue as the reference',
        'Match the full sequence length instead of rushing the ending',
        'Keep pauses and transitions consistent across retries',
        ...(dropMetric?.label === 'Timing' && dropMetric.delta < 0 ? ['Do one take focused only on timing recovery before changing pose size.'] : []),
      ];
    case 'detection stability':
      return [
        'Step back until the whole body stays inside the frame',
        'Use steadier light and avoid clutter crossing the body outline',
        'Reduce motion blur with a stable phone position if possible',
        ...(dropMetric?.label === 'Stability' && dropMetric.delta < 0 ? ['Do not change framing and lighting at the same time on the next retry.'] : []),
      ];
    case 'pose similarity':
      return [
        'Match the big body shapes before worrying about speed',
        'Check arm and leg endpoints at the main poses',
        'Hold the finish positions long enough for the camera to read them',
        ...(dropMetric?.label === 'Pose' && dropMetric.delta < 0 ? ['Run one slower take to recover body shape accuracy before increasing speed again.'] : []),
      ];
    default:
      return [
        'Keep the next take close to the reference camera setup',
        'Change only one variable at a time between retries',
        'Review the archive after each retry to see which axis moved',
        ...(dropMetric && dropMetric.delta < 0 ? [`Check why ${dropMetric.label} moved ${formatMetricDelta(dropMetric.delta)} before changing more variables.`] : []),
      ];
  }
}

function buildKeepChecklist(strongestArea: AttemptBreakdownArea | null, improvementMetric: ChallengeComparisonMetric | null) {
  switch (strongestArea) {
    case 'timing':
      return [
        'Keep the same rhythm and pacing on the next take',
        'Do not trade timing accuracy for larger motions unless needed',
        ...(improvementMetric?.label === 'Timing' && improvementMetric.delta > 0 ? ['Keep the same cueing and sequence length on the next retry.'] : []),
      ];
    case 'detection stability':
      return [
        'Reuse the same camera distance and lighting setup',
        'Protect the clean frame while adjusting the movement itself',
        ...(improvementMetric?.label === 'Stability' && improvementMetric.delta > 0 ? ['Reuse the same camera distance because it clearly helped this retry.'] : []),
      ];
    case 'pose similarity':
      return [
        'Preserve the current body shapes and endpoint positions',
        'Only fine-tune timing or framing on the next pass',
        ...(improvementMetric?.label === 'Pose' && improvementMetric.delta > 0 ? ['Keep the same body-shape emphasis because it improved the latest run.'] : []),
      ];
    default:
      return [
        'Keep the same camera placement',
        'Repeat in similar light and room conditions',
        ...(improvementMetric && improvementMetric.delta > 0 ? [`Preserve the condition that improved ${improvementMetric.label} by ${formatMetricDelta(improvementMetric.delta)}.`] : []),
      ];
  }
}

function buildPrimaryDeltaMetric(
  attempt: AttemptSummary,
  mode: 'best' | 'worst',
): ChallengeComparisonMetric | null {
  const metrics = buildComparisonMetrics(attempt);
  if (metrics.length === 0) {
    return null;
  }

  return buildMetricDeltaSummary(metrics, mode);
}

function buildBreakdownCards(attempt: AttemptSummary | null): BreakdownCard[] {
  if (!attempt || attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable) {
    return [
      {
        title: 'Breakdown unavailable',
        tone: 'neutral',
        badge: 'Waiting',
        body: 'Detailed breakdown cards appear after a real auto-scored upload result is ready.',
      },
    ];
  }

  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const weakestArea = resolveBreakdownArea(attempt, 'weakest');

  return [
    buildBreakdownCard('pose similarity', strongestArea, weakestArea, attempt.poseSimilarity),
    buildBreakdownCard('timing', strongestArea, weakestArea, attempt.timingSimilarity),
    buildBreakdownCard('detection stability', strongestArea, weakestArea, attempt.stabilitySimilarity),
  ];
}

function buildBreakdownCard(
  area: AttemptBreakdownArea,
  strongestArea: AttemptBreakdownArea | null,
  weakestArea: AttemptBreakdownArea | null,
  scoreValue: number | null,
): BreakdownCard {
  if (strongestArea === area) {
    return {
      title: toAreaLabel(area),
      tone: 'strong',
      badge: scoreValue == null ? 'Strongest' : `${scoreValue} / 100`,
      body: `${toAreaLabel(area)} was the most stable match in this run. Keep this part consistent while you improve the weaker axis.`,
    };
  }

  if (weakestArea === area) {
    return {
      title: toAreaLabel(area),
      tone: 'warn',
      badge: scoreValue == null ? 'Needs work' : `${scoreValue} / 100`,
      body: `${toAreaLabel(area)} created the biggest gap against the reference. This is the best place to focus on the next retry.`,
    };
  }

  return {
    title: toAreaLabel(area),
    tone: 'neutral',
    badge: scoreValue == null ? 'Measured' : `${scoreValue} / 100`,
    body:
      scoreValue != null && scoreValue >= 80
        ? `${toAreaLabel(area)} stayed fairly strong and was not the main source of score loss.`
        : `${toAreaLabel(area)} stayed in the middle range. It is not the top issue, but there is still room to tighten it up.`,
  };
}

function resolveBreakdownArea(
  attempt: AttemptSummary,
  mode: 'strongest' | 'weakest',
): AttemptBreakdownArea | null {
  const direct = mode === 'strongest' ? attempt.strongestArea : attempt.weakestArea;
  if (direct) {
    return direct;
  }

  const strongestMatch = attempt.resultSummary.match(/Strongest area: ([^.]+)\./i);
  const weakestMatch =
    attempt.resultSummary.match(/while ([^.]+) pulled the score down\./i) ??
    attempt.resultSummary.match(/but ([^.]+) still differs\./i) ??
    attempt.resultSummary.match(/Weakest area: ([^.]+)\./i);

  const raw = mode === 'strongest' ? strongestMatch?.[1] : weakestMatch?.[1];
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('pose')) {
    return 'pose similarity';
  }
  if (normalized.includes('timing')) {
    return 'timing';
  }
  if (normalized.includes('stability')) {
    return 'detection stability';
  }
  return null;
}

function toAreaLabel(area: AttemptBreakdownArea) {
  return toAttemptBreakdownLabel(area);
}

function buildResultStatusMeta(attempt: AttemptSummary | null): ResultMeta {
  return {
    label: 'Result status',
    value: attempt?.status ?? 'Checking',
  };
}

function buildScoreStateMeta(attempt: AttemptSummary | null): ResultMeta {
  return {
    label: 'Score state',
    value: attempt?.scoreAvailable ? 'Score available' : 'Score pending',
  };
}

function buildResultSourceMeta(source: AttemptResultSource | null | undefined): ResultMeta {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return { label: 'Result source', value: 'Auto-scored upload' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { label: 'Result source', value: 'Sample preview' };
    case 'PREPARED_FLOW':
      return { label: 'Result source', value: 'Prepared flow' };
    default:
      return { label: 'Result source', value: 'Unknown source' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null | undefined): ResultMeta {
  switch (mode) {
    case 'SYNC_INLINE':
      return { label: 'Processing mode', value: 'Inline processing' };
    case 'ASYNC_JOB_PENDING':
      return { label: 'Processing mode', value: 'Async pending' };
    default:
      return { label: 'Processing mode', value: 'Default flow' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean | null | undefined): ResultMeta {
  return {
    label: 'Processing state',
    value: processingComplete ? 'Completed' : 'Needs review',
  };
}

function buildCurrentStageSummary(attempt: AttemptSummary | null) {
  if (!attempt) {
    return 'Loading result state.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return 'Upload accepted, but analysis or scoring is still in progress.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'Reference comparison is complete.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return 'Saved preview result.';
  }

  return 'Prepared record only.';
}

function buildProcessFeedToneClass(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'result-process-feed--completed';
  }

  switch (progress.status) {
    case 'PENDING':
      return 'result-process-feed--pending';
    case 'PROCESSING':
      return 'result-process-feed--processing';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH'
        ? 'result-process-feed--failed-high'
        : 'result-process-feed--failed-warn';
    case 'COMPLETED':
    default:
      return 'result-process-feed--completed';
  }
}

function buildProgressStatusLabel(status: AttemptVideoProcessingJobProgress['status']) {
  return buildDurableProgressStatusTag({ status } as AttemptVideoProcessingJobProgress);
}

function buildAnalyzerLabel(attempt: AttemptSummary) {
  if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'Saved result view';
  }
  return 'MediaPipe pose analyzer';
}

function formatAttemptedAt(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

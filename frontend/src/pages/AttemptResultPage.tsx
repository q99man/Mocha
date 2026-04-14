import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAttemptById, getAttemptVideoProcessingProgressByTrackingId } from '../shared/api/attemptApi';
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

type ResultMeta = { label: string; value: string };
type InsightCard = { title: string; body: string };
type BreakdownCard = { title: string; tone: 'strong' | 'warn' | 'neutral'; badge: string; body: string };
type CoachingCard = { title: string; tone: 'accent' | 'warn' | 'neutral'; body: string; checklist: string[] };
type ChallengeComparisonMetric = { label: string; delta: number };
type ChallengeComparison = { previousAttemptId: number; previousAttemptedAt: string | null; scoreDelta: number; summary: string; metrics: ChallengeComparisonMetric[] };

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
      setError('결과 ID가 없습니다.');
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
        if (!cancelled) setAttempt(nextAttempt);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '시도 결과를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
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
  const processingCompleteMeta = useMemo(() => buildProcessingCompleteMeta(attempt?.processingComplete), [attempt?.processingComplete]);
  const currentStage = useMemo(() => buildCurrentStageSummary(attempt), [attempt]);
  const heroDescription = useMemo(() => buildHeroDescription(attempt), [attempt]);
  const methodologyNote = useMemo(() => buildMethodologyNote(attempt), [attempt]);
  const comparison = useMemo(() => buildChallengeComparison(attempt), [attempt]);
  const insightCards = useMemo(() => buildInsightCards(attempt, comparison), [attempt, comparison]);
  const breakdownCards = useMemo(() => buildBreakdownCards(attempt), [attempt]);
  const coachingCards = useMemo(() => buildCoachingCards(attempt), [attempt]);
  const pendingProcessWarning = !!attempt && (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING');
  const effectiveProgress = jobProgress ?? buildDurableProgressSnapshotFromAttempt(attempt);
  const progressResultAttemptId = effectiveProgress?.resultAttemptId ?? null;
  const processFeedToneClass = useMemo(() => buildProcessFeedToneClass(effectiveProgress), [effectiveProgress]);

  async function reloadDurableProgress() {
    if (!attempt?.pendingTrackingId) {
      setProgressMessage('아직 이 결과에 연결된 추적 ID가 없습니다.');
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
          setProgressMessage(`처리가 완료되어 결과 #${progress.resultAttemptId}로 이동합니다.`);
          navigate(`/attempts/${progress.resultAttemptId}/result`);
          return;
        }
        const nextAttempt = await getAttemptById(resolvedAttemptId);
        setAttempt(nextAttempt);
        nextMessage = progress.resultAttemptId != null && progress.resultAttemptId === attempt.id
          ? `처리가 완료되어 결과 #${progress.resultAttemptId}를 새로 반영했습니다.`
          : '처리가 완료되어 최신 결과 상세를 새로 반영했습니다.';
      } else if (progress.status === 'FAILED') {
        const nextAttempt = await getAttemptById(attempt.id);
        setAttempt(nextAttempt);
        nextMessage = `${buildDurableProgressRefreshMessage(progress)} 결과 상세도 함께 갱신했습니다.`;
      }
      setProgressMessage(nextMessage);
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : '처리 상태를 새로고침하지 못했습니다.');
    } finally {
      setProgressLoading(false);
    }
  }

  if (loading) return <section className="result-page"><p>결과를 불러오는 중입니다...</p></section>;

  if (error || !attempt) {
    return (
      <section className="result-page">
        <div className="result-page__hero">
          <p className="result-page__eyebrow">시도 결과</p>
          <h1>결과를 표시할 수 없습니다</h1>
          <p>{error ?? '요청한 시도 결과를 찾을 수 없습니다.'}</p>
          <div className="result-page__actions">
            <Link to="/attempts" className="button">시도 목록으로 돌아가기</Link>
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
            <p className="result-page__eyebrow">시도 결과</p>
            <h1>{attempt.resultHeadline || '시도 결과'}</h1>
            <p>{heroDescription}</p>
          </div>
          <div className="result-page__member-meta">
            <span>member</span>
            <strong>{attempt.memberDisplayName}</strong>
            <span>{attempt.memberEmail}</span>
          </div>
          <div className="result-scoreboard">
            <span className="result-scoreboard__label">점수</span>
            <strong>{attempt.scoreAvailable ? attempt.score : '--'}</strong>
            <span className="result-scoreboard__suffix">점</span>
          </div>
        </div>
        <div className="result-page__actions">
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button">이 챌린지 다시 도전</Link>
          <Link to={`/attempts?challengeId=${attempt.challengeId}`} className="button button--secondary">챌린지 아카이브 열기</Link>
        </div>
      </header>

      {pendingProcessWarning ? (
        <div className="result-warning-feed">
          <strong>{buildDurableProgressCalloutTitle(effectiveProgress)}</strong>
          <p>{buildDurableProgressSummary(effectiveProgress) ?? attempt.processingNotice ?? '최종 결과가 준비되기 전까지 이 결과는 한 번 더 진행 상태 새로고침이 필요합니다.'}</p>
          {effectiveProgress ? <p>{buildDurableProgressNextStep(effectiveProgress)}</p> : null}
          <div className="inline-actions">
            <button type="button" className="button button--secondary" onClick={() => void reloadDurableProgress()} disabled={progressLoading}>
              {progressLoading ? '새로고침 중...' : '처리 상태 새로고침'}
            </button>
            {progressResultAttemptId ? <Link to={`/attempts/${progressResultAttemptId}/result`} className="button-link">완료된 결과 열기</Link> : null}
          </div>
          {progressMessage ? <p className="result-page__detail-note">{progressMessage}</p> : null}
        </div>
      ) : null}

      <section className="result-page__status-grid">
        {[resultStatusMeta, scoreStateMeta, resultSourceMeta, processingModeMeta, processingCompleteMeta].map((meta) => (
          <div className="result-page__status-card" key={meta.label}><span>{meta.label}</span><strong>{meta.value}</strong></div>
        ))}
      </section>

      {comparison ? (
        <section className="result-page__comparison-grid">
          <article className={`result-page__comparison-card result-page__comparison-card--${comparison.scoreDelta >= 0 ? 'good' : 'warn'}`}>
            <span className="result-page__comparison-label">이전 시도 비교</span>
            <h2>{comparison.scoreDelta >= 0 ? `+${comparison.scoreDelta}점` : `${comparison.scoreDelta}점`}</h2>
            <p>{comparison.summary}</p>
            {comparison.metrics.length > 0 ? (
              <div className="result-page__comparison-metrics">
                {comparison.metrics.map((metric) => (
                  <span key={metric.label} className={metric.delta >= 0 ? 'result-page__comparison-chip result-page__comparison-chip--good' : 'result-page__comparison-chip result-page__comparison-chip--warn'}>
                    {metric.label} {metric.delta >= 0 ? `+${metric.delta}` : metric.delta}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="result-page__detail-note">이전 시도 #{comparison.previousAttemptId} ({formatAttemptedAt(comparison.previousAttemptedAt ?? null)})와 비교한 결과입니다.</p>
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
          <article key={card.title} className="result-page__insight-card"><h2>{card.title}</h2><p>{card.body}</p></article>
        ))}
      </section>

      <section className="result-page__coach-grid">
        {coachingCards.map((card) => (
          <article key={card.title} className={`result-page__coach-card result-page__coach-card--${card.tone}`}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
            <ul className="result-page__coach-list">{card.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </section>

      <section className={`result-process-feed ${processFeedToneClass}`}>
        <strong>이 점수가 만들어진 기준</strong>
        <div className="result-process-feed__grid">
          <div><span>현재 단계</span><strong>{currentStage}</strong></div>
          <div><span>분석기</span><strong>{buildAnalyzerLabel(attempt)}</strong></div>
          <div><span>점수 기준</span><strong>포즈 모양 + 포즈 타이밍 + 검출 품질</strong></div>
          <div><span>해석</span><strong>{methodologyNote}</strong></div>
        </div>
      </section>

      <section className="result-page__detail-grid">
        <article className="result-page__detail-card">
          <h2>결과 요약</h2>
          <p>{attempt.resultSummary}</p>
          <p className="result-page__detail-note">{methodologyNote}</p>
          {attempt.processingNotice ? <p className="result-page__detail-note">{attempt.processingNotice}</p> : null}
          {effectiveProgress ? (
            <dl className="result-progress-meta">
              <div><dt>처리 상태</dt><dd>{buildProgressStatusLabel(effectiveProgress.status)}</dd></div>
              <div><dt>완료 방식</dt><dd>{buildDurableProgressCompletionStrategyLabel(effectiveProgress.completionStrategy)}</dd></div>
              <div><dt>경과 시간</dt><dd>{buildDurableProgressElapsedTimeLabel(effectiveProgress.elapsedSeconds)}</dd></div>
              <div><dt>원본 파일</dt><dd>{effectiveProgress.originalFileName ?? '알 수 없는 파일'}</dd></div>
            </dl>
          ) : null}
        </article>

        <article className="result-page__detail-card">
          <h2>시도 상세</h2>
          <dl className="result-page__detail-list">
            <div><dt>회원</dt><dd>{attempt.memberDisplayName}</dd></div>
            <div><dt>계정</dt><dd>{attempt.memberEmail}</dd></div>
            <div><dt>시도 ID</dt><dd>#{attempt.id}</dd></div>
            <div><dt>챌린지</dt><dd>{attempt.challengeTitle || `챌린지 #${attempt.challengeId}`}</dd></div>
            <div><dt>결과 출처</dt><dd>{resultSourceMeta.value}</dd></div>
            <div><dt>처리 방식</dt><dd>{processingModeMeta.value}</dd></div>
            <div><dt>가장 강한 영역</dt><dd>{attempt.strongestArea ? toAreaLabel(attempt.strongestArea) : '분석 대기 중'}</dd></div>
            <div><dt>가장 약한 영역</dt><dd>{attempt.weakestArea ? toAreaLabel(attempt.weakestArea) : '분석 대기 중'}</dd></div>
            <div><dt>업로드 시각</dt><dd>{formatAttemptedAt(attempt.attemptedAt)}</dd></div>
            <div><dt>원본 파일</dt><dd>{attempt.originalFileName ?? '알 수 없는 파일'}</dd></div>
          </dl>
        </article>
      </section>

      <section className="result-page__actions-grid">
        <article className="result-page__action-card">
          <h3>같은 챌린지로 다시 도전</h3>
          <p>레퍼런스 챌린지는 그대로 두고 한 번에 한 가지만 바꾸면 점수 흐름을 더 읽기 쉬워집니다.</p>
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button button--secondary">챌린지 시작 화면으로</Link>
        </article>
        <article className="result-page__action-card">
          <h3>아카이브에서 비교하기</h3>
          <p>시도 아카이브에서 이전 재도전, 낮은 점수 결과, 같은 취약 축과 이 결과를 나란히 비교할 수 있습니다.</p>
          <Link to={`/attempts?challengeId=${attempt.challengeId}`} className="button button--secondary">챌린지 아카이브 열기</Link>
        </article>
        <article className="result-page__action-card">
          <h3>챌린지 세팅 다시 보기</h3>
          <p>레퍼런스 출처, 실행 상태, 모델 기반 분석 설정을 다시 확인하고 싶다면 챌린지 상세를 확인해 보세요.</p>
          <Link to={`/challenges/${attempt.challengeId}`} className="button button--secondary">챌린지 상세 열기</Link>
        </article>
      </section>
    </section>
  );
}

function buildHeroDescription(attempt: AttemptSummary | null) {
  if (!attempt) return '결과 화면을 준비하고 있습니다.';
  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') return '분석이 아직 진행 중입니다. 최종 결과가 준비되면 아래 진행 상태를 새로고침해 이어서 확인해 주세요.';
  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') return '이 결과는 저장된 챌린지 레퍼런스와 실제 업로드 영상을 비교해 만든 결과입니다. 점수와 세부 분석은 현재 분석기 출력을 그대로 사용합니다.';
  return '아카이브에서 불러온 저장된 시도 기록입니다.';
}

function buildMethodologyNote(attempt: AttemptSummary | null) {
  if (!attempt) return '결과 상세를 확인하는 중입니다.';
  if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED') return '이 항목은 실제 영상-레퍼런스 비교 결과가 아니어서 세부 가이드는 제한적으로만 제공됩니다.';
  return '현재 채점 모델은 포즈 모양과 포즈 타이밍을 우선 반영하고, 검출 품질은 보조 신호로 작게 반영합니다.';
}

function buildChallengeComparison(attempt: AttemptSummary | null): ChallengeComparison | null {
  if (!attempt || attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable || attempt.previousAttemptId == null || attempt.scoreDeltaFromPrevious == null) return null;
  const metrics = buildComparisonMetrics(attempt);
  const summary = attempt.scoreDeltaFromPrevious > 0
    ? `이번 재도전은 이전 결과보다 좋아졌습니다. ${buildAreaShiftSummary(attempt)}`
    : attempt.scoreDeltaFromPrevious < 0
      ? `이번 재도전은 이전 결과보다 점수가 낮아졌습니다. ${buildAreaShiftSummary(attempt)}`
      : `이번 재도전은 이전 결과와 같은 점수입니다. ${buildAreaShiftSummary(attempt)}`;
  return { previousAttemptId: attempt.previousAttemptId, previousAttemptedAt: attempt.previousAttemptedAt, scoreDelta: attempt.scoreDeltaFromPrevious, summary, metrics };
}

function buildAreaShiftSummary(current: AttemptSummary) {
  if (current.weakestArea) return `${toAreaLabel(current.weakestArea)}이 다음 재도전에서 가장 먼저 집중할 지점입니다.`;
  if (current.strongestArea) return `${toAreaLabel(current.strongestArea)}이 최근 재도전에서도 가장 강하게 유지됐습니다.`;
  return '촬영 세팅을 안정적으로 맞춘 뒤 한 번 더 재도전하면 분석 해석이 더 선명해집니다.';
}

function buildComparisonMetrics(current: AttemptSummary): ChallengeComparisonMetric[] {
  return [buildComparisonMetric('모양', current.poseDeltaFromPrevious), buildComparisonMetric('타이밍', current.timingDeltaFromPrevious), buildComparisonMetric('품질', current.stabilityDeltaFromPrevious)].filter((metric): metric is ChallengeComparisonMetric => metric !== null);
}
function buildComparisonMetric(label: string, delta: number | null): ChallengeComparisonMetric | null { return delta == null ? null : { label, delta }; }
function buildMetricDeltaSummary(metrics: ChallengeComparisonMetric[], mode: 'best' | 'worst'): ChallengeComparisonMetric | null {
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((left, right) => left.delta - right.delta);
  return mode === 'best' ? sorted[sorted.length - 1] : sorted[0];
}
function formatMetricDelta(delta: number) { return delta >= 0 ? `+${delta}` : `${delta}`; }

function buildInsightCards(attempt: AttemptSummary | null, comparison: ChallengeComparison | null): InsightCard[] {
  if (!attempt) return [];
  const score = attempt.score;
  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const weakestArea = resolveBreakdownArea(attempt, 'weakest');
  const mostImprovedMetric = comparison ? buildMetricDeltaSummary(comparison.metrics, 'best') : null;
  const mostDroppedMetric = comparison ? buildMetricDeltaSummary(comparison.metrics, 'worst') : null;
  return [
    {
      title: '점수 해석',
      body: attempt.scoreAvailable
        ? score >= 90 ? '현재 분석기 기준으로 레퍼런스와 매우 가깝습니다. 같은 클립이거나 아주 정교하게 맞춘 재도전일 가능성이 큽니다.'
        : score >= 75 ? '전체 흐름은 가깝지만, 한두 개의 채점 축에서는 아직 눈에 띄는 차이가 남아 있습니다.'
        : score >= 55 ? '동작은 부분적으로 맞지만 포즈 모양, 타이밍, 검출 품질 중 일부가 아직 점수를 끌어내리고 있습니다.'
        : '분석기가 레퍼런스와의 차이를 크게 보고 있습니다. 다른 동작이거나 검출 품질이 낮거나 카메라 세팅이 크게 다른 경우일 수 있습니다.'
        : '점수가 아직 확정되지 않았습니다. 처리가 끝나면 상태를 새로고침해 주세요.',
    },
    {
      title: '점수가 이렇게 나온 이유',
      body: attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED'
        ? `이 결과는 포즈 모양, 포즈 타이밍, 검출 품질을 함께 반영합니다.${strongestArea ? ` 가장 안정적으로 맞은 축은 ${toAreaLabel(strongestArea)}입니다.` : ''}${weakestArea ? ` 가장 크게 점수를 깎은 축은 ${toAreaLabel(weakestArea)}입니다.` : ''}`
        : '이 결과는 실제 자동 채점 업로드가 아니므로 설명 강도도 실제 비교보다 가볍습니다.',
    },
    {
      title: '직전 재도전 대비 변화',
      body: comparison
        ? `${mostImprovedMetric ? `${mostImprovedMetric.label}이 가장 많이 좋아졌습니다 (${formatMetricDelta(mostImprovedMetric.delta)}). ` : ''}${mostDroppedMetric && mostDroppedMetric.delta < 0 ? `${mostDroppedMetric.label}이 가장 많이 떨어졌습니다 (${formatMetricDelta(mostDroppedMetric.delta)}).` : '이전 재도전 대비 크게 떨어진 축은 없습니다.'}`
        : '이 챌린지의 첫 채점 재도전 결과이므로, 다음 결과들은 이 기록을 기준으로 비교됩니다.',
    },
  ];
}

function buildCoachingCards(attempt: AttemptSummary | null): CoachingCard[] {
  if (!attempt || attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable) {
    return [{ title: '채점 후 코칭이 활성화됩니다', tone: 'neutral', body: '실제 자동 채점 업로드가 끝나면 이 영역이 세부 분석을 바탕으로 다음 재도전 조언을 보여줍니다.', checklist: ['실제 챌린지 영상을 업로드하기', '최종 점수 기다리기', '결과 다시 열기'] }];
  }
  const weakestArea = resolveBreakdownArea(attempt, 'weakest');
  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const improvementMetric = buildPrimaryDeltaMetric(attempt, 'best');
  const dropMetric = buildPrimaryDeltaMetric(attempt, 'worst');
  return [
    {
      title: '다음 재도전 계획',
      tone: weakestArea ? 'warn' : 'accent',
      body: attempt.retryFocus ?? (weakestArea ? `${toAreaLabel(weakestArea)}이 다음 촬영에서 가장 빠르게 개선할 수 있는 지점입니다.${dropMetric && dropMetric.delta < 0 ? ` ${dropMetric.label}도 이전 재도전보다 ${formatMetricDelta(dropMetric.delta)}만큼 떨어졌습니다.` : ''}` : '한 가지 약점이 압도적이지 않으므로 다음 촬영에서도 전체 세팅을 최대한 동일하게 유지해 주세요.'),
      checklist: buildRetryChecklist(weakestArea, dropMetric),
    },
    {
      title: '유지할 강점',
      tone: 'accent',
      body: attempt.keepStableFocus ?? (strongestArea ? `${toAreaLabel(strongestArea)}이 가장 잘 유지됐으니, 약한 부분을 고치는 동안 이 강점은 그대로 가져가 주세요.${improvementMetric && improvementMetric.delta > 0 ? ` ${improvementMetric.label}은 지난 재도전 대비 ${formatMetricDelta(improvementMetric.delta)} 좋아졌습니다.` : ''}` : '아직 뚜렷한 최강 축이 보이지 않으니 재도전 사이에서 전체 세팅을 통일해 주세요.'),
      checklist: buildKeepChecklist(strongestArea, improvementMetric),
    },
    {
      title: '촬영 체크리스트',
      tone: 'neutral',
      body: attempt.scoreDeltaFromPrevious == null ? '매 재도전마다 같은 촬영 체크리스트를 쓰면 점수 변화를 훨씬 해석하기 쉬워집니다.' : `이번 결과는 직전 재도전 대비 ${formatMetricDelta(attempt.scoreDeltaFromPrevious)} ${attempt.scoreDeltaFromPrevious >= 0 ? '상승' : '하락'}했으니 촬영 변수는 더 엄격하게 고정해 주세요.`,
      checklist: ['머리부터 발끝까지 몸 전체가 프레임 안에 보이게 하기', '움직이기 전에 레퍼런스 시작 타이밍 맞추기', '강한 역광이나 빠른 카메라 흔들림 피하기'],
    },
  ];
}

function buildRetryChecklist(weakestArea: AttemptBreakdownArea | null, dropMetric: ChallengeComparisonMetric | null) {
  switch (weakestArea) {
    case 'pose timing': return ['레퍼런스와 같은 박자나 큐에서 동작을 시작하기', '마무리를 서두르지 말고 전체 시퀀스 길이를 맞추기', '재도전마다 멈춤과 전환 타이밍을 최대한 일정하게 유지하기', ...(dropMetric?.label === '타이밍' && dropMetric.delta < 0 ? ['포즈 크기를 바꾸기 전에 타이밍 회복에만 집중한 촬영을 한 번 해보기'] : [])];
    case 'detection quality': return ['몸 전체가 프레임 안에 들어올 때까지 한 걸음 뒤로 물러서기', '조명을 더 안정적으로 맞추고 몸 윤곽선을 가리는 배경 요소 줄이기', '가능하면 휴대폰 위치를 고정해 모션 블러 줄이기', ...(dropMetric?.label === '품질' && dropMetric.delta < 0 ? ['다음 재도전에서는 구도와 조명을 동시에 바꾸지 않기'] : [])];
    case 'pose shape': return ['속도보다 먼저 큰 몸 모양을 맞추는 데 집중하기', '핵심 포즈에서 팔과 다리 끝점 위치를 확인하기', '카메라가 읽을 수 있도록 마무리 자세를 충분히 유지하기', ...(dropMetric?.label === '모양' && dropMetric.delta < 0 ? ['다시 속도를 올리기 전에 천천히 한 번 촬영해 몸 모양 정확도를 회복하기'] : [])];
    default: return ['다음 촬영도 레퍼런스 카메라 세팅과 최대한 비슷하게 유지하기', '재도전 사이에는 한 번에 한 가지 변수만 바꾸기', '매 재도전 후 아카이브에서 어떤 축이 움직였는지 확인하기', ...(dropMetric && dropMetric.delta < 0 ? [`다른 변수를 더 바꾸기 전에 ${dropMetric.label}이 ${formatMetricDelta(dropMetric.delta)} 변한 이유를 먼저 확인하기`] : [])];
  }
}
function buildKeepChecklist(strongestArea: AttemptBreakdownArea | null, improvementMetric: ChallengeComparisonMetric | null) {
  switch (strongestArea) {
    case 'pose timing': return ['다음 촬영에서도 같은 리듬과 속도를 유지하기', '필요하지 않다면 타이밍 정확도를 큰 동작으로 바꾸지 않기', ...(improvementMetric?.label === '타이밍' && improvementMetric.delta > 0 ? ['다음 재도전에서도 같은 큐와 시퀀스 길이를 유지하기'] : [])];
    case 'detection quality': return ['같은 카메라 거리와 조명 세팅을 재사용하기', '동작을 고치더라도 깨끗한 프레임 상태는 유지하기', ...(improvementMetric?.label === '품질' && improvementMetric.delta > 0 ? ['이번 재도전에 도움이 됐으니 같은 카메라 거리를 유지하기'] : [])];
    case 'pose shape': return ['현재 몸 모양과 끝점 위치를 그대로 유지하기', '다음 촬영에서는 타이밍이나 구도만 미세 조정하기', ...(improvementMetric?.label === '모양' && improvementMetric.delta > 0 ? ['최신 결과 개선에 도움이 됐으니 같은 몸 모양 중심 전략을 유지하기'] : [])];
    default: return ['카메라 위치를 동일하게 유지하기', '비슷한 조명과 공간 조건에서 반복하기', ...(improvementMetric && improvementMetric.delta > 0 ? [`${improvementMetric.label}을 ${formatMetricDelta(improvementMetric.delta)} 개선한 조건을 유지하기`] : [])];
  }
}

function buildPrimaryDeltaMetric(attempt: AttemptSummary, mode: 'best' | 'worst'): ChallengeComparisonMetric | null {
  const metrics = buildComparisonMetrics(attempt);
  if (metrics.length === 0) return null;
  return buildMetricDeltaSummary(metrics, mode);
}
function buildBreakdownCards(attempt: AttemptSummary | null): BreakdownCard[] {
  if (!attempt || attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' || !attempt.scoreAvailable) return [{ title: '세부 분석 대기 중', tone: 'neutral', badge: '대기 중', body: '실제 자동 채점 업로드 결과가 준비되면 세부 분석 카드가 표시됩니다.' }];
  const strongestArea = resolveBreakdownArea(attempt, 'strongest');
  const weakestArea = resolveBreakdownArea(attempt, 'weakest');
  return [buildBreakdownCard('pose shape', strongestArea, weakestArea, attempt.poseSimilarity), buildBreakdownCard('pose timing', strongestArea, weakestArea, attempt.timingSimilarity), buildBreakdownCard('detection quality', strongestArea, weakestArea, attempt.stabilitySimilarity)];
}
function buildBreakdownCard(area: AttemptBreakdownArea, strongestArea: AttemptBreakdownArea | null, weakestArea: AttemptBreakdownArea | null, scoreValue: number | null): BreakdownCard {
  if (strongestArea === area) return { title: toAreaLabel(area), tone: 'strong', badge: scoreValue == null ? '가장 강함' : `${scoreValue} / 100`, body: `${toAreaLabel(area)}이 이번 결과에서 가장 안정적으로 맞았습니다. 약한 축을 보완하는 동안 이 부분은 그대로 유지해 주세요.` };
  if (weakestArea === area) return { title: toAreaLabel(area), tone: 'warn', badge: scoreValue == null ? '보완 필요' : `${scoreValue} / 100`, body: `${toAreaLabel(area)}이 레퍼런스와의 가장 큰 차이를 만들었습니다. 다음 재도전에서는 이 축에 가장 먼저 집중하는 것이 좋습니다.` };
  return { title: toAreaLabel(area), tone: 'neutral', badge: scoreValue == null ? '측정됨' : `${scoreValue} / 100`, body: scoreValue != null && scoreValue >= 80 ? `${toAreaLabel(area)}은 비교적 강하게 유지되어 주요 감점 원인은 아니었습니다.` : `${toAreaLabel(area)}은 중간 수준으로 유지됐습니다. 가장 큰 문제는 아니지만 더 다듬을 여지가 있습니다.` };
}
function resolveBreakdownArea(attempt: AttemptSummary, mode: 'strongest' | 'weakest'): AttemptBreakdownArea | null {
  const direct = mode === 'strongest' ? attempt.strongestArea : attempt.weakestArea;
  if (direct) return direct;
  const strongestMatch = attempt.resultSummary.match(/Strongest area: ([^.]+)\./i);
  const weakestMatch = attempt.resultSummary.match(/while ([^.]+) pulled the score down\./i) ?? attempt.resultSummary.match(/but ([^.]+) still differs\./i) ?? attempt.resultSummary.match(/Weakest area: ([^.]+)\./i);
  const raw = mode === 'strongest' ? strongestMatch?.[1] : weakestMatch?.[1];
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('pose')) return 'pose shape';
  if (normalized.includes('timing')) return 'pose timing';
  if (normalized.includes('quality') || normalized.includes('detection')) return 'detection quality';
  return null;
}
function toAreaLabel(area: AttemptBreakdownArea) { return toAttemptBreakdownLabel(area); }
function buildResultStatusMeta(attempt: AttemptSummary | null): ResultMeta { return { label: '결과 상태', value: attempt?.status ?? '확인 중' }; }
function buildScoreStateMeta(attempt: AttemptSummary | null): ResultMeta { return { label: '점수 상태', value: attempt?.scoreAvailable ? '점수 준비됨' : '점수 대기 중' }; }
function buildResultSourceMeta(source: AttemptResultSource | null | undefined): ResultMeta {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED': return { label: '결과 출처', value: '자동 채점 업로드' };
    case 'SAMPLE_SCORING_PREVIEW': return { label: '결과 출처', value: '샘플 미리보기' };
    case 'PREPARED_FLOW': return { label: '결과 출처', value: '준비 흐름' };
    default: return { label: '결과 출처', value: '알 수 없는 출처' };
  }
}
function buildProcessingModeMeta(mode: AttemptProcessingMode | null | undefined): ResultMeta {
  switch (mode) {
    case 'SYNC_INLINE': return { label: '처리 방식', value: '즉시 처리' };
    case 'ASYNC_JOB_PENDING': return { label: '처리 방식', value: '비동기 대기' };
    default: return { label: '처리 방식', value: '기본 흐름' };
  }
}
function buildProcessingCompleteMeta(processingComplete: boolean | null | undefined): ResultMeta { return { label: '처리 상태', value: processingComplete ? '완료됨' : '확인 필요' }; }
function buildCurrentStageSummary(attempt: AttemptSummary | null) {
  if (!attempt) return '결과 상태를 불러오는 중입니다.';
  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') return '업로드는 접수되었지만 분석 또는 채점이 아직 진행 중입니다.';
  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') return '레퍼런스 비교가 완료되었습니다.';
  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') return '저장된 미리보기 결과입니다.';
  return '준비 기록만 있는 상태입니다.';
}
function buildProcessFeedToneClass(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) return 'result-process-feed--completed';
  switch (progress.status) {
    case 'PENDING': return 'result-process-feed--pending';
    case 'PROCESSING': return 'result-process-feed--processing';
    case 'FAILED': return progress.failureSeverity === 'HIGH' ? 'result-process-feed--failed-high' : 'result-process-feed--failed-warn';
    default: return 'result-process-feed--completed';
  }
}
function buildProgressStatusLabel(status: AttemptVideoProcessingJobProgress['status']) { return buildDurableProgressStatusTag({ status } as AttemptVideoProcessingJobProgress); }
function buildAnalyzerLabel(attempt: AttemptSummary) { return attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED' ? '저장된 결과 화면' : 'MediaPipe 포즈 분석기'; }
function formatAttemptedAt(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

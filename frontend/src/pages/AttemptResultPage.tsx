import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  getAttemptById,
  getAttemptVideoProcessingProgressByTrackingId,
} from '../shared/api/attemptApi';
import { buildDurableProgressSnapshotFromAttempt } from '../shared/presentation/durableProgress';
import type {
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

export function AttemptResultPage() {
  const { id } = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<AttemptVideoProcessingJobProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('결과를 확인할 시도 ID가 없습니다.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAttempt() {
      setLoading(true);
      setError(null);
      try {
        const nextAttempt = await getAttemptById(Number(id));
        if (!cancelled) {
          setAttempt(nextAttempt);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '결과를 불러오지 못했습니다.');
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
  const insightCards = useMemo(() => buildInsightCards(attempt), [attempt]);
  const pendingProcessWarning =
    !!attempt && (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING');
  const effectiveProgress = jobProgress ?? buildDurableProgressSnapshotFromAttempt(attempt);
  const progressResultAttemptId = effectiveProgress?.resultAttemptId ?? null;
  const processFeedToneClass = useMemo(() => buildProcessFeedToneClass(effectiveProgress), [effectiveProgress]);

  async function reloadDurableProgress() {
    if (!attempt?.pendingTrackingId) {
      setProgressMessage('다시 조회할 trackingId가 아직 없습니다.');
      return;
    }

    setProgressLoading(true);
    setProgressMessage(null);
    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(attempt.pendingTrackingId);
      setJobProgress(progress);
      setProgressMessage(buildProgressRefreshMessage(progress));
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : '진행 상태를 다시 확인하지 못했습니다.');
    } finally {
      setProgressLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="result-page">
        <p>결과를 불러오는 중입니다...</p>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="result-page">
        <div className="result-page__hero">
          <p className="result-page__eyebrow">Attempt Result</p>
          <h1>결과를 확인하지 못했습니다.</h1>
          <p>{error ?? '요청한 시도 기록을 찾지 못했습니다.'}</p>
          <div className="result-page__actions">
            <Link to="/attempts" className="button">
              기록 목록으로 이동
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
            <h1>{attempt.resultHeadline || '도전 결과'}</h1>
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
            같은 챌린지 다시 도전
          </Link>
          <Link to="/attempts" className="button button--secondary">
            기록 목록 보기
          </Link>
        </div>
      </header>

      {pendingProcessWarning ? (
        <div className="result-warning-feed">
          <strong>처리 확인이 더 필요합니다</strong>
          <p>{attempt.processingNotice ?? '처리 상태를 다시 확인한 뒤 결과를 이어서 확인해 주세요.'}</p>
          <div className="inline-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reloadDurableProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? '진행 상태 확인 중...' : '진행 상태 새로고침'}
            </button>
            {progressResultAttemptId ? (
              <Link to={`/attempts/${progressResultAttemptId}/result`} className="button-link">
                완료 결과 열기
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

      <section className="result-page__insights">
        {insightCards.map((card) => (
          <article key={card.title} className="result-page__insight-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className={`result-process-feed ${processFeedToneClass}`}>
        <strong>채점 방식 설명</strong>
        <div className="result-process-feed__grid">
          <div>
            <span>현재 단계</span>
            <strong>{currentStage}</strong>
          </div>
          <div>
            <span>분석기</span>
            <strong>{buildAnalyzerLabel(attempt)}</strong>
          </div>
          <div>
            <span>점수 산정 기준</span>
            <strong>동작 시그니처 + 길이 + 샘플 수</strong>
          </div>
          <div>
            <span>해석 팁</span>
            <strong>{methodologyNote}</strong>
          </div>
        </div>
      </section>

      <section className="result-page__detail-grid">
        <article className="result-page__detail-card">
          <h2>결과 안내</h2>
          <p>{attempt.resultSummary}</p>
          <p className="result-page__detail-note">{methodologyNote}</p>
          {attempt.processingNotice ? <p className="result-page__detail-note">{attempt.processingNotice}</p> : null}
          {effectiveProgress ? (
            <dl className="result-progress-meta">
              <div>
                <dt>진행 상태</dt>
                <dd>{buildProgressStatusLabel(effectiveProgress.status)}</dd>
              </div>
              <div>
                <dt>완료 방식</dt>
                <dd>{buildCompletionStrategyLabel(effectiveProgress.completionStrategy)}</dd>
              </div>
              <div>
                <dt>경과 시간</dt>
                <dd>{buildElapsedLabel(effectiveProgress.elapsedSeconds)}</dd>
              </div>
              <div>
                <dt>업로드 파일</dt>
                <dd>{effectiveProgress.originalFileName ?? '파일명 없음'}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className="result-page__detail-card">
          <h2>상세 정보</h2>
          <dl className="result-page__detail-list">
            <div>
              <dt>시도 ID</dt>
              <dd>#{attempt.id}</dd>
            </div>
            <div>
              <dt>챌린지</dt>
              <dd>{attempt.challengeTitle || `챌린지 #${attempt.challengeId}`}</dd>
            </div>
            <div>
              <dt>결과 출처</dt>
              <dd>{resultSourceMeta.value}</dd>
            </div>
            <div>
              <dt>처리 방식</dt>
              <dd>{processingModeMeta.value}</dd>
            </div>
            <div>
              <dt>현재 단계</dt>
              <dd>{currentStage}</dd>
            </div>
            <div>
              <dt>업로드 시각</dt>
              <dd>{formatAttemptedAt(attempt.attemptedAt)}</dd>
            </div>
            <div>
              <dt>업로드 파일</dt>
              <dd>{attempt.originalFileName ?? '파일명 없음'}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="result-page__actions-grid">
        <article className="result-page__action-card">
          <h3>같은 챌린지 다시 도전하기</h3>
          <p>구도와 타이밍을 조정한 뒤 다시 업로드하면 점수 차이를 바로 비교하기 쉽습니다.</p>
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button button--secondary">
            시작 화면으로 이동
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>기록 목록에서 비교하기</h3>
          <p>이전 시도들과 함께 보면 어떤 업로드가 더 안정적으로 점수를 받았는지 확인할 수 있습니다.</p>
          <Link to="/attempts" className="button button--secondary">
            기록 목록 보기
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>챌린지 상세 확인</h3>
          <p>레퍼런스가 실제 영상 기반인지, 현재 어떤 챌린지를 기준으로 비교했는지 다시 확인할 수 있습니다.</p>
          <Link to={`/challenges/${attempt.challengeId}`} className="button button--secondary">
            챌린지 상세로 이동
          </Link>
        </article>
      </section>
    </section>
  );
}

function buildHeroDescription(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과를 준비하는 중입니다.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return '분석과 채점이 아직 진행 중입니다. 아래 진행 상태를 새로고침하면서 완료 여부를 확인해 주세요.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '레퍼런스 영상과 업로드 영상을 자동 비교한 결과입니다. 지금 점수는 현재 분석 엔진 기준의 비교 결과입니다.';
  }

  return '저장된 시도 결과를 불러왔습니다.';
}

function buildMethodologyNote(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과를 확인하는 중입니다.';
  }

  if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED') {
    return '이 결과는 실제 영상 비교가 아닌 준비/샘플 흐름일 수 있습니다.';
  }

  return '현재 엔진은 포즈 기반 요약값을 비교합니다. 화면 구도, 검출 안정성, 영상 길이 차이도 점수에 영향을 줄 수 있습니다.';
}

function buildInsightCards(attempt: AttemptSummary | null): InsightCard[] {
  if (!attempt) {
    return [];
  }

  const score = attempt.score;
  const scoreCard: InsightCard = {
    title: '점수 해석',
    body: attempt.scoreAvailable
      ? score >= 90
        ? '레퍼런스와 매우 가깝게 인식된 결과입니다. 같은 영상이거나, 길이와 포즈 패턴이 거의 동일하게 잡혔을 가능성이 높습니다.'
        : score >= 75
          ? '전체 흐름은 꽤 비슷하게 인식됐습니다. 세부 타이밍이나 자세 안정성에서 약간의 차이가 있었을 수 있습니다.'
          : score >= 55
            ? '비슷한 동작은 감지됐지만 차이도 분명히 있었습니다. 구도, 검출된 프레임 수, 자세 유지가 점수에 영향을 줬을 가능성이 큽니다.'
            : '현재 엔진 기준으로는 차이가 큰 편으로 잡혔습니다. 다른 동작이거나, 검출이 불안정했던 업로드일 수 있습니다.'
      : '점수가 아직 확정되지 않았습니다. 처리 완료 후 다시 확인해 주세요.',
  };

  const engineCard: InsightCard = {
    title: '왜 이런 점수가 나왔나',
    body:
      attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED'
        ? '지금 점수는 포즈 요약 시그니처, 영상 길이 차이, 검출 샘플 수 차이를 함께 반영합니다. 즉 사람이 보기엔 비슷해도 검출 안정성이 다르면 점수가 내려갈 수 있습니다.'
        : '이 결과는 실제 영상 자동 비교보다는 준비/샘플 흐름 설명에 가깝습니다.',
  };

  const nextActionCard: InsightCard = {
    title: '다음에 해볼 것',
    body:
      !attempt.scoreAvailable
        ? '처리가 끝난 뒤 다시 결과를 확인해 주세요.'
        : score >= 85
          ? '이제는 다른 사람, 다른 구도, 다른 속도의 영상으로 점수 분리도가 충분한지 비교해보는 단계가 좋습니다.'
          : score >= 60
            ? '카메라 구도와 시작 타이밍을 더 맞춘 뒤 다시 업로드해 보세요. 같은 동작이어도 점수가 꽤 달라질 수 있습니다.'
            : '레퍼런스와 최대한 같은 시작 지점, 같은 전신 구도, 같은 속도로 다시 촬영해 보세요. 현재 엔진은 그 차이에 민감합니다.',
  };

  return [scoreCard, engineCard, nextActionCard];
}

function buildResultStatusMeta(attempt: AttemptSummary | null): ResultMeta {
  return {
    label: '결과 상태',
    value: attempt?.status ?? '확인 중',
  };
}

function buildScoreStateMeta(attempt: AttemptSummary | null): ResultMeta {
  return {
    label: '점수 상태',
    value: attempt?.scoreAvailable ? '점수 확인 가능' : '점수 준비 중',
  };
}

function buildResultSourceMeta(source: AttemptResultSource | null | undefined): ResultMeta {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return { label: '결과 출처', value: '실제 영상 자동 비교' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { label: '결과 출처', value: '샘플 미리보기' };
    case 'PREPARED_FLOW':
      return { label: '결과 출처', value: '준비 단계 기록' };
    default:
      return { label: '결과 출처', value: '정보 없음' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null | undefined): ResultMeta {
  switch (mode) {
    case 'SYNC_INLINE':
      return { label: '처리 방식', value: '즉시 처리' };
    case 'ASYNC_JOB_PENDING':
      return { label: '처리 방식', value: '비동기 대기' };
    default:
      return { label: '처리 방식', value: '프로토타입/기본 흐름' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean | null | undefined): ResultMeta {
  return {
    label: '진행 상태',
    value: processingComplete ? '처리 완료' : '처리 확인 필요',
  };
}

function buildCurrentStageSummary(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과를 불러오는 중입니다.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return '업로드는 되었고, 분석 또는 채점이 아직 진행 중입니다.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '레퍼런스와 자동 비교가 끝났습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '샘플 결과가 저장된 상태입니다.';
  }

  return '준비 상태 기록입니다.';
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

function buildProgressRefreshMessage(progress: AttemptVideoProcessingJobProgress) {
  if (progress.status === 'COMPLETED') {
    return progress.resultAttemptId
      ? `처리가 완료되었습니다. 결과 #${progress.resultAttemptId}로 바로 이동할 수 있습니다.`
      : '처리가 완료되었습니다.';
  }

  if (progress.status === 'FAILED') {
    return progress.processingNotice ?? '처리가 실패했습니다. 브리지와 백엔드 로그를 함께 확인해 주세요.';
  }

  if (progress.status === 'PROCESSING') {
    return '분석과 채점이 진행 중입니다. 잠시 후 다시 확인해 주세요.';
  }

  return '처리 대기 중입니다. 잠시 후 다시 확인해 주세요.';
}

function buildProgressStatusLabel(status: AttemptVideoProcessingJobProgress['status']) {
  switch (status) {
    case 'PENDING':
      return '대기 중';
    case 'PROCESSING':
      return '분석/채점 진행 중';
    case 'COMPLETED':
      return '처리 완료';
    case 'FAILED':
      return '처리 실패';
    default:
      return status;
  }
}

function buildCompletionStrategyLabel(strategy: AttemptVideoProcessingJobProgress['completionStrategy']) {
  switch (strategy) {
    case 'AUTO_RUNNER':
      return '백그라운드 자동 완료';
    case 'MANUAL_COMPLETION':
      return '수동 완료 처리';
    case 'INLINE_FLOW':
      return '즉시 처리';
    default:
      return '확인 중';
  }
}

function buildElapsedLabel(elapsedSeconds: number) {
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}초`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

function buildAnalyzerLabel(attempt: AttemptSummary) {
  if (attempt.resultSource !== 'VIDEO_UPLOAD_AUTOSCORED') {
    return '기본 결과 해석';
  }
  return 'MediaPipe pose analyzer';
}

function formatAttemptedAt(value: string) {
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

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  getAttemptById,
  getAttemptVideoProcessingProgressByTrackingId,
} from '../shared/api/attemptApi';
import {
  buildDurableProgressCompletionLinkDescription,
  buildDurableProgressCompletionLinkLabel,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRefreshMessage,
  buildDurableProgressRetryWindowLabel,
  buildDurableProgressSnapshotFromAttempt,
} from '../shared/presentation/durableProgress';
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

type ProcessingTimeline = {
  source: string;
  mode: string;
  processState: string;
  currentStage: string;
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
  const processingTimeline = useMemo(() => buildProcessingTimeline(attempt), [attempt]);
  const currentStage = useMemo(() => buildCurrentStageSummary(attempt), [attempt]);
  const bannerDescription = useMemo(() => resultBannerDescription(attempt), [attempt]);
  const sourceDescription = useMemo(() => resultSourceDescription(attempt), [attempt]);
  const pendingProcessWarning =
    !!attempt && (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING');
  const effectiveProgress = jobProgress ?? buildDurableProgressSnapshotFromAttempt(attempt);
  const progressResultAttemptId = effectiveProgress?.resultAttemptId ?? null;

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
      setProgressMessage(
        buildDurableProgressRefreshMessage(progress, {
          sourceLabel: 'trackingId direct progress',
        }),
      );
    } catch (loadError) {
      setProgressMessage(loadError instanceof Error ? loadError.message : 'durable progress 상태를 다시 확인하지 못했습니다.');
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
        <p className="result-page__eyebrow">Attempt Result</p>
        <h1>{attempt.resultHeadline ?? '시도 결과'}</h1>
        <p>{bannerDescription}</p>
        <div className="result-page__actions">
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button">
            다시 시작 준비하기
          </Link>
          <Link to="/attempts" className="button button--secondary">
            기록 목록 보기
          </Link>
        </div>
      </header>

      {pendingProcessWarning ? (
        <div className="result-warning-feed">
          <strong>처리 확인 필요</strong>
          <p>{attempt.processingNotice ?? '처리 상태를 한 번 더 확인한 뒤 결과를 이어서 확인해 주세요.'}</p>
          <div className="inline-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void reloadDurableProgress()}
              disabled={progressLoading}
            >
              {progressLoading ? '상태 다시 확인 중...' : 'durable progress 다시 확인'}
            </button>
            {progressResultAttemptId ? (
              <Link to={`/attempts/${progressResultAttemptId}/result`} className="button-link">
                {buildDurableProgressCompletionLinkLabel()}
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

      <section className="result-page__metrics">
        <article className="result-page__metric-card">
          <span>점수</span>
          <strong>{attempt.scoreAvailable ? `${attempt.score}점` : '아직 준비 중'}</strong>
        </article>
        <article className="result-page__metric-card">
          <span>결과 출처</span>
          <strong>{resultSourceMeta.value}</strong>
        </article>
        <article className="result-page__metric-card">
          <span>처리 방식</span>
          <strong>{processingModeMeta.value}</strong>
        </article>
        <article className="result-page__metric-card">
          <span>현재 단계</span>
          <strong>{currentStage}</strong>
        </article>
      </section>

      <section className={`result-process-feed ${pendingProcessWarning ? 'result-process-feed--pending' : 'result-process-feed--completed'}`}>
        <h2>처리 이력 요약</h2>
        <div className="result-process-feed__grid">
          <div>
            <span>결과 출처</span>
            <strong>{processingTimeline.source}</strong>
          </div>
          <div>
            <span>처리 방식</span>
            <strong>{processingTimeline.mode}</strong>
          </div>
          <div>
            <span>진행 상태</span>
            <strong>{processingTimeline.processState}</strong>
          </div>
          <div>
            <span>현재 단계</span>
            <strong>{processingTimeline.currentStage}</strong>
          </div>
        </div>
      </section>

      <section className="result-page__detail-grid">
        <article className="result-page__detail-card">
          <h2>결과 안내</h2>
          <p>{attempt.resultSummary}</p>
          <p className="result-page__detail-note">{sourceDescription}</p>
          {attempt.processingNotice ? <p className="result-page__detail-note">{attempt.processingNotice}</p> : null}
          {effectiveProgress ? (
            <>
              <p className="result-page__detail-note">
                최근 durable progress 상태: {effectiveProgress.status}
                {effectiveProgress.resultAttemptId ? ` / 완료 결과 #${effectiveProgress.resultAttemptId}` : ''}
              </p>
              <dl className="result-progress-meta">
                <div>
                  <dt>완료 방식</dt>
                  <dd>{buildDurableProgressCompletionStrategyLabel(effectiveProgress.completionStrategy)}</dd>
                </div>
                <div>
                  <dt>누적 처리 시간</dt>
                  <dd>{buildDurableProgressElapsedTimeLabel(effectiveProgress.elapsedSeconds)}</dd>
                </div>
                <div>
                  <dt>자동 재시도 여유</dt>
                  <dd>{buildDurableProgressRetryWindowLabel(effectiveProgress)}</dd>
                </div>
                <div>
                  <dt>업로드 파일</dt>
                  <dd>{buildDurableProgressOriginalFileLabel(effectiveProgress)}</dd>
                </div>
              </dl>
            </>
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
              <dd>{attempt.challengeTitle ?? `챌린지 #${attempt.challengeId}`}</dd>
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
              <dt>진행 상태</dt>
              <dd>{processingCompleteMeta.value}</dd>
            </div>
            <div>
              <dt>현재 단계</dt>
              <dd>{currentStage}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="result-page__actions-grid">
        <article className="result-page__action-card">
          <h3>같은 챌린지 다시 준비하기</h3>
          <p>준비 저장, 영상 업로드, async pending 확인 흐름을 다시 이어서 볼 수 있습니다.</p>
          <Link to={`/challenges/${attempt.challengeId}/start`} className="button button--secondary">
            시작 화면으로 이동
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>기록 목록으로 돌아가기</h3>
          <p>이 시도와 다른 결과를 처리 방식과 결과 출처 기준으로 비교해 볼 수 있습니다.</p>
          <Link to="/attempts" className="button button--secondary">
            기록 목록 보기
          </Link>
        </article>
        <article className="result-page__action-card">
          <h3>챌린지 상세 보기</h3>
          <p>레퍼런스 분석 상태와 현재 챌린지 정보를 다시 확인할 수 있습니다.</p>
          <Link to={`/challenges/${attempt.challengeId}`} className="button button--secondary">
            챌린지 상세로 이동
          </Link>
        </article>
      </section>
    </section>
  );
}

function resultBannerDescription(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과를 준비 중입니다.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return '처리가 아직 이어지고 있습니다. 이 화면에서 상태를 다시 확인하고, 완료되면 결과를 바로 이어서 확인할 수 있습니다.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '자동 채점이 완료되었습니다. 결과 화면에서 바로 이어서 비교하고 확인할 수 있습니다.';
  }

  return '결과 화면에서 바로 이어서 확인할 수 있는 단계까지 모두 완료되었습니다.';
}

function resultSourceDescription(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과 출처를 확인하는 중입니다.';
  }

  switch (attempt.resultSource) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '업로드한 영상을 기준으로 자동 채점을 진행한 결과입니다.';
    case 'SAMPLE_SCORING_PREVIEW':
      return '프로토타입용 샘플 완료 결과를 저장한 기록입니다.';
    case 'PREPARED_FLOW':
      return '실제 채점 전 준비 상태를 저장한 기록입니다.';
    default:
      return '결과 출처를 다시 확인한 뒤 현재 결과를 이어서 확인해 주세요.';
  }
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
      return { label: '결과 출처', value: '실제 자동 채점' };
    case 'SAMPLE_SCORING_PREVIEW':
      return { label: '결과 출처', value: '샘플 preview' };
    case 'PREPARED_FLOW':
      return { label: '결과 출처', value: '준비 저장' };
    default:
      return { label: '결과 출처', value: '정보 없음' };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null | undefined): ResultMeta {
  switch (mode) {
    case 'SYNC_INLINE':
      return { label: '처리 방식', value: '동기 처리' };
    case 'ASYNC_JOB_PENDING':
      return { label: '처리 방식', value: '비동기 대기' };
    default:
      return { label: '처리 방식', value: '프로토타입 저장' };
  }
}

function buildProcessingCompleteMeta(processingComplete: boolean | null | undefined): ResultMeta {
  return {
    label: '진행 상태',
    value: processingComplete ? '처리 완료' : '처리 확인 필요',
  };
}

function buildProcessingTimeline(attempt: AttemptSummary | null): ProcessingTimeline {
  return {
    source: buildResultSourceMeta(attempt?.resultSource).value,
    mode: buildProcessingModeMeta(attempt?.processingMode).value,
    processState: buildProcessingCompleteMeta(attempt?.processingComplete).value,
    currentStage: buildCurrentStageSummary(attempt),
  };
}

function buildCurrentStageSummary(attempt: AttemptSummary | null) {
  if (!attempt) {
    return '결과를 불러오는 중입니다.';
  }

  if (!attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING') {
    return 'trackingId 재조회나 로컬 완료 처리로 다음 단계를 이어서 확인할 수 있습니다.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '자동 채점이 끝나 결과 화면에서 바로 이어서 비교하고 확인할 수 있습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '샘플 완료 결과가 저장되어 결과 화면에서 바로 이어서 확인할 수 있습니다.';
  }

  return '준비 상태가 저장된 뒤 다음 단계 전 확인 기록으로 볼 수 있습니다.';
}
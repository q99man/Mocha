import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAttemptById } from '../shared/api/attemptApi';
import { StatusGlyph } from '../shared/components/StatusGlyph';
import type {
  AttemptProcessingMode,
  AttemptResultSource,
  AttemptSummary,
} from '../shared/types/attempt';

export function AttemptResultPage() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttempt() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttemptById(id);
        if (active) {
          setAttempt(response);
        }
      } catch (loadError) {
        if (active) {
          setAttempt(null);
          setError(loadError instanceof Error ? loadError.message : '결과 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempt();

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
            <h2>결과 화면을 준비하고 있습니다</h2>
            <p>점수, 상태, 처리 방식, 결과 출처를 정리하는 중입니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">ERROR</span>
          <div>
            <h2>결과 화면을 불러올 수 없습니다</h2>
            <p>{error ?? '선택한 기록을 찾을 수 없습니다.'}</p>
          </div>
        </div>
        <Link className="button-link" to="/attempts">
          기록 목록으로 이동
        </Link>
      </section>
    );
  }

  const resultStatus = buildResultStatusMeta(attempt.status);
  const resultSource = buildResultSourceMeta(attempt.resultSource);
  const scoreState = buildScoreStateMeta(attempt.scoreAvailable);
  const processingMode = buildProcessingModeMeta(attempt.processingMode);
  const processingComplete = buildProcessingCompleteMeta(attempt.processingComplete);
  const processingTimeline = buildProcessingTimeline(attempt);
  const pendingProcessWarning = !attempt.processingComplete || attempt.processingMode === 'ASYNC_JOB_PENDING';

  return (
    <div className="page">
      <section className="hero hero--result">
        <div className="hero__content">
          <span className="hero__eyebrow">RESULT SCREEN / ATT-{String(attempt.id).padStart(3, '0')}</span>
          <h2>{attempt.challengeTitle}</h2>
          <p>{attempt.resultSummary}</p>
          <div className="result-scoreboard">
            <span className="result-scoreboard__label">FINAL SCORE</span>
            <strong>{attempt.score}</strong>
            <span className="result-scoreboard__suffix">PTS</span>
          </div>
        </div>

        <div className="hero__aside">
          <div className="result-shell__banner panel-lift panel-lift--accent">
            <strong>{attempt.resultHeadline}</strong>
            <p>{resultBannerDescription(attempt.resultSource)}</p>
          </div>
          {pendingProcessWarning ? (
            <div className="result-warning-feed">
              <strong>처리 확인 필요</strong>
              <p>{attempt.processingNotice ?? '이 결과는 아직 처리 대기 중이거나 후속 확인이 필요한 상태입니다.'}</p>
            </div>
          ) : null}
          <div className="status-marquee status-marquee--compact">
            <div className={`status-marquee__item status-marquee__item--${resultStatus.tone}`}>
              <span className="status-marquee__icon">
                <StatusGlyph kind={resultStatus.icon} tone={resultStatus.tone} />
              </span>
              <div>
                <span className="status-marquee__label">RESULT STATE</span>
                <strong>{resultStatus.title}</strong>
                <p>{resultStatus.description}</p>
              </div>
            </div>
            <div className={`status-marquee__item status-marquee__item--${scoreState.tone}`}>
              <span className="status-marquee__icon">
                <StatusGlyph kind={scoreState.icon} tone={scoreState.tone} />
              </span>
              <div>
                <span className="status-marquee__label">SCORE STATE</span>
                <strong>{scoreState.title}</strong>
                <p>{scoreState.description}</p>
              </div>
            </div>
            <div className={`status-marquee__item status-marquee__item--${resultSource.tone}`}>
              <span className="status-marquee__icon">
                <StatusGlyph kind={resultSource.icon} tone={resultSource.tone} />
              </span>
              <div>
                <span className="status-marquee__label">RESULT SOURCE</span>
                <strong>{resultSource.title}</strong>
                <p>{resultSource.description}</p>
              </div>
            </div>
            <div className={`status-marquee__item status-marquee__item--${processingMode.tone}`}>
              <span className="status-marquee__icon">
                <StatusGlyph kind={processingMode.icon} tone={processingMode.tone} />
              </span>
              <div>
                <span className="status-marquee__label">PROCESS MODE</span>
                <strong>{processingMode.title}</strong>
                <p>{processingMode.description}</p>
              </div>
            </div>
            <div className={`status-marquee__item status-marquee__item--${processingComplete.tone}`}>
              <span className="status-marquee__icon">
                <StatusGlyph kind={processingComplete.icon} tone={processingComplete.tone} />
              </span>
              <div>
                <span className="status-marquee__label">PROCESS STATE</span>
                <strong>{processingComplete.title}</strong>
                <p>{processingComplete.description}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>결과 메트릭</h2>
              <p>시작 화면에서 보던 처리 규칙을 결과 화면에서도 같은 언어로 이어서 보여줍니다.</p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-card stat-card--accent">
              <strong>기록 상태</strong>
              <p>{attempt.status}</p>
            </div>
            <div className="stat-card">
              <strong>점수 사용 여부</strong>
              <p>{scoreState.title}</p>
            </div>
            <div className="stat-card">
              <strong>처리 방식</strong>
              <p>{processingMode.title}</p>
            </div>
            <div className="stat-card">
              <strong>처리 상태</strong>
              <p>{processingComplete.title}</p>
            </div>
            <div className="stat-card">
              <strong>저장 시각</strong>
              <p>{new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
            </div>
          </div>
        </article>

        <article className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>흐름 해석</h2>
              <p>기록이 어떤 경로를 거쳐 저장됐는지, 지금은 어떤 단계인지 한 번에 읽기 쉽게 정리했습니다.</p>
            </div>
          </div>
          <div className="result-process-feed">
            <strong>처리 이력 요약</strong>
            <ul className="result-process-feed__list">
              {processingTimeline.map((item, index) => (
                <li className="result-process-feed__item" key={`${item.title}-${index}`}>
                  <span className="pill">{item.title}</span>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="detail-list">
            <li>
              <strong>현재 결과 출처</strong>
              {resultSourceDescription(attempt.resultSource)}
            </li>
            <li>
              <strong>처리 방식 해석</strong>
              {processingMode.description}
            </li>
            <li>
              <strong>처리 완료 여부</strong>
              {attempt.processingNotice ?? processingComplete.description}
            </li>
            <li>
              <strong>검증 흐름과의 연결</strong>
              업로드 시작 화면에서 확인한 상태가 결과 화면에서는 실제 자동 채점, 샘플 preview, 준비 상태 저장 중 하나의 출처로 이어집니다.
            </li>
          </ul>
        </article>
      </section>

      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">03</span>
          <div>
            <h2>다음 액션</h2>
            <p>검증에서 결과까지 자연스럽게 이어지도록 후속 이동 경로를 같은 축으로 정리했습니다.</p>
          </div>
        </div>
        <div className="result-actions-grid">
          <div className="result-action-card panel-lift panel-lift--accent">
            <strong>같은 챌린지 다시 준비하기</strong>
            <p>카메라 준비 화면으로 돌아가 다시 촬영하거나 업로드 검증 흐름을 반복할 수 있습니다.</p>
            <Link className="button-link" to={`/challenges/${attempt.challengeId}/start`}>
              다시 준비하기
            </Link>
          </div>
          <div className="result-action-card panel-lift">
            <strong>기록 목록에서 비교하기</strong>
            <p>준비 상태 저장, 샘플 preview, 실제 자동 채점 결과를 한 화면에서 비교할 수 있습니다.</p>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 목록 보기
            </Link>
          </div>
          <div className="result-action-card panel-lift">
            <strong>챌린지 상세로 돌아가기</strong>
            <p>레퍼런스와 시작 흐름을 다시 보고 다음 시도를 준비할 수 있습니다.</p>
            <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
              챌린지 상세 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function resultBannerDescription(source: AttemptResultSource): string {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '이 결과는 실제로 업로드한 시도 영상을 기준으로 mock 분석과 자동 채점을 거쳐 만들어졌습니다.';
    case 'SAMPLE_SCORING_PREVIEW':
      return '이 결과는 실제 업로드 자동 채점이 아니라, 결과 구조를 먼저 확인하기 위한 샘플 preview 흐름입니다.';
    default:
      return '이 결과는 준비 단계 저장 기록이며, 이후 실제 업로드 자동 채점 결과와 같은 구조로 비교할 수 있습니다.';
  }
}

function resultSourceDescription(source: AttemptResultSource): string {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '검증 화면에서 확인한 실제 업로드 영상이 서버로 전달되고, 자동 채점까지 마친 결과입니다.';
    case 'SAMPLE_SCORING_PREVIEW':
      return '실제 업로드 전에 결과 구조를 먼저 확인하기 위한 샘플 preview 결과입니다.';
    default:
      return '준비 단계에서 저장한 기록으로, 실제 자동 채점 전 상태를 확인하는 용도입니다.';
  }
}

function buildResultStatusMeta(status: AttemptSummary['status']) {
  if (status === '준비됨') {
    return {
      tone: 'neutral' as const,
      icon: 'RDY',
      title: '준비 상태 저장',
      description: '실제 자동 채점 전 상태를 기록해 둔 프로토타입 기록입니다.',
    };
  }

  return {
    tone: 'good' as const,
    icon: 'CLR',
    title: '완료 결과 저장',
    description: '샘플 완료 또는 실제 자동 채점 결과가 저장된 상태입니다.',
  };
}

function buildScoreStateMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return {
      tone: 'good' as const,
      icon: 'PTS',
      title: '점수 사용 가능',
      description: '결과 화면과 기록 목록에서 바로 점수를 비교할 수 있습니다.',
    };
  }

  return {
    tone: 'warn' as const,
    icon: 'WAIT',
    title: '점수 준비 중',
    description: '이 기록은 점수 반영보다 흐름 확인 목적이 더 큰 상태입니다.',
  };
}

function buildResultSourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        title: '실제 자동 채점',
        description: '업로드한 영상을 기준으로 자동 채점까지 끝난 결과입니다.',
      };
    case 'SAMPLE_SCORING_PREVIEW':
      return {
        tone: 'warn' as const,
        icon: 'SAMP',
        title: '샘플 preview 결과',
        description: '실제 업로드 대신 preview 기준으로 만든 결과입니다.',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'SAVE',
        title: '준비 상태 저장',
        description: '실제 채점 전 단계에서 저장한 준비 기록입니다.',
      };
  }
}

function buildProcessingModeMeta(mode: AttemptProcessingMode | null) {
  switch (mode) {
    case 'SYNC_INLINE':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        title: '동기 처리',
        description: '업로드 직후 같은 요청 안에서 분석과 채점을 바로 마친 흐름입니다.',
      };
    case 'ASYNC_JOB_PENDING':
      return {
        tone: 'warn' as const,
        icon: 'WAIT',
        title: '비동기 대기',
        description: '대기 작업이 마무리되면 결과가 이어지는 구조를 위한 처리 방식입니다.',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'SAVE',
        title: '프로토타입 저장',
        description: '실제 업로드 처리 대신 수동 또는 샘플 흐름으로 만든 결과입니다.',
      };
  }
}

function buildProcessingTimeline(attempt: AttemptSummary) {
  return [
    {
      title: '결과 출처',
      description: resultSourceDescription(attempt.resultSource),
    },
    {
      title: '처리 방식',
      description: buildProcessingModeMeta(attempt.processingMode).description,
    },
    {
      title: '처리 상태',
      description: attempt.processingNotice ?? buildProcessingCompleteMeta(attempt.processingComplete).description,
    },
    {
      title: '현재 단계',
      description: buildCurrentStageSummary(attempt),
    },
  ];
}

function buildCurrentStageSummary(attempt: AttemptSummary): string {
  if (attempt.status === '준비됨') {
    return '준비 저장만 끝난 상태입니다. 다음에는 실제 업로드나 자동 채점 흐름으로 이어질 수 있습니다.';
  }

  if (attempt.processingMode === 'ASYNC_JOB_PENDING' && !attempt.processingComplete) {
    return '업로드는 접수됐지만 후속 처리 완료가 아직 남아 있습니다. 결과 화면과 기록 목록에서 상태를 계속 확인해 주세요.';
  }

  if (attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return '실제 업로드 자동 채점까지 마친 완료 기록입니다. 다른 시도와 바로 비교할 수 있습니다.';
  }

  if (attempt.resultSource === 'SAMPLE_SCORING_PREVIEW') {
    return '샘플 preview 기준으로 결과 구조를 먼저 확인한 기록입니다. 실제 업로드 결과와는 구분해서 보면 좋습니다.';
  }

  return '현재 기록은 결과 비교가 가능한 완료 상태입니다.';
}

function buildProcessingCompleteMeta(processingComplete: boolean) {
  if (processingComplete) {
    return {
      tone: 'good' as const,
      icon: 'CLR',
      title: '처리 완료',
      description: '현재 결과 화면에서 확인할 수 있는 단계까지 처리가 모두 끝났습니다.',
    };
  }

  return {
    tone: 'warn' as const,
    icon: 'WAIT',
    title: '처리 대기',
    description: '분석과 채점의 후속 완료 단계가 아직 남아 있습니다.',
  };
}
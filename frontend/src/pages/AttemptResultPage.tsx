import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAttemptById } from '../shared/api/attemptApi';
import { StatusGlyph } from '../shared/components/StatusGlyph';
import type { AttemptResultSource, AttemptSummary } from '../shared/types/attempt';

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
            <p>점수, 상태, 결과 헤드라인과 출처 정보를 정리하는 중입니다.</p>
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
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>결과 메트릭</h2>
              <p>시작 화면에서 보던 상태 규칙을 결과 화면에서도 같은 언어로 이어줍니다.</p>
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
              <strong>결과 출처</strong>
              <p>{resultSource.title}</p>
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
              <p>검수 단계에서 보던 문구와 같은 기준으로 이 결과가 어디서 왔는지 빠르게 읽을 수 있게 정리했습니다.</p>
            </div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>현재 결과 상태</strong>
              {resultSourceDescription(attempt.resultSource)}
            </li>
            <li>
              <strong>검수 흐름과의 연결</strong>
              업로드 검수 패널에서 확인한 영상은 이 화면에서 `실제 업로드 자동 채점`, `샘플 preview 결과`, `준비 상태 저장` 중 하나의 출처로 이어집니다.
            </li>
            <li>
              <strong>다음 확장 방향</strong>
              이후 단계에서는 실제 자세 비교 수치와 피드백 블록도 이 결과 구조 안으로 자연스럽게 확장할 수 있습니다.
            </li>
          </ul>
        </article>
      </section>

      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">03</span>
          <div>
            <h2>다음 액션</h2>
            <p>검수에서 결과까지 자연스럽게 이어지도록 후속 이동 경로도 같은 톤으로 정리했습니다.</p>
          </div>
        </div>
        <div className="result-actions-grid">
          <div className="result-action-card panel-lift panel-lift--accent">
            <strong>같은 챌린지 다시 준비하기</strong>
            <p>카메라 준비 화면으로 돌아가 다시 촬영하거나 업로드 검수 흐름을 반복할 수 있습니다.</p>
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
      return '검수한 시도 영상을 실제로 업로드한 뒤 mock 분석과 자동 채점을 거쳐 만들어진 결과입니다.';
    case 'SAMPLE_SCORING_PREVIEW':
      return '이 결과는 실제 업로드 자동 채점이 아니라 샘플 preview 흐름으로 생성된 결과입니다.';
    default:
      return '이 결과는 준비 단계 저장 기록이며, 이후 실제 업로드 자동 채점 결과와 같은 구조로 비교할 수 있습니다.';
  }
}

function resultSourceDescription(source: AttemptResultSource): string {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '검수 패널에서 확인한 실제 업로드 영상이 서버로 전달되고, 자동 채점까지 끝난 결과입니다.';
    case 'SAMPLE_SCORING_PREVIEW':
      return '실제 업로드 전 결과 구조를 먼저 확인하기 위한 샘플 preview 결과입니다.';
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
      description: '실제 자동 채점 전 상태를 기록한 세이브입니다.',
    };
  }

  return {
    tone: 'good' as const,
    icon: 'CLR',
    title: '완료 결과 저장',
    description: '샘플 완료 또는 실제 자동 채점 결과가 기록된 상태입니다.',
  };
}

function buildScoreStateMeta(scoreAvailable: boolean) {
  if (scoreAvailable) {
    return {
      tone: 'good' as const,
      icon: 'PTS',
      title: '점수 사용 가능',
      description: '결과 카드와 기록 목록에서 즉시 점수를 비교할 수 있습니다.',
    };
  }

  return {
    tone: 'warn' as const,
    icon: 'WAIT',
    title: '점수 준비 중',
    description: '이 기록은 아직 점수 반영보다 흐름 확인 목적이 더 큽니다.',
  };
}

function buildResultSourceMeta(source: AttemptResultSource) {
  switch (source) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return {
        tone: 'good' as const,
        icon: 'LIVE',
        title: '실제 업로드 자동 채점',
        description: '업로드한 비디오를 기준으로 자동 채점까지 완료된 결과입니다.',
      };
    case 'SAMPLE_SCORING_PREVIEW':
      return {
        tone: 'warn' as const,
        icon: 'SAMP',
        title: '샘플 preview 결과',
        description: '실제 업로드 대신 데모 scoring preview 기준으로 생성된 결과입니다.',
      };
    default:
      return {
        tone: 'neutral' as const,
        icon: 'SAVE',
        title: '준비 상태 저장',
        description: '실제 채점 전 저장된 준비 상태 기록입니다.',
      };
  }
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
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
          setError(loadError instanceof Error ? loadError.message : '챌린지 상세 정보를 불러오지 못했습니다.');
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
          <span className="section-heading__code">로딩</span>
          <div>
            <h2>챌린지 상세 정보를 불러오는 중입니다</h2>
            <p>레퍼런스 준비 상태와 최근 재도전 흐름을 확인하고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">오류</span>
          <div>
            <h2>챌린지 상세 정보를 불러오지 못했습니다</h2>
            <p>{error}</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          챌린지 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="panel panel--section">
        <div className="section-heading">
          <span className="section-heading__code">없음</span>
          <div>
            <h2>챌린지를 찾을 수 없습니다</h2>
            <p>선택한 챌린지가 없거나 더 이상 활성화되어 있지 않습니다.</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          챌린지 목록으로 돌아가기
        </Link>
      </section>
    );
  }

  const recentRetry = challenge.latestRetrySummary;

  return (
    <div className="page">
      <section className="hero hero--detail">
        <div className="hero__media">
          <ChallengeVisual
            title={challenge.title}
            thumbnailUrl={challenge.thumbnailUrl}
            fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
            className="hero__image"
            placeholderClassName="hero__image hero__image--placeholder"
          />
        </div>

        <div className="hero__content">
          <span className="hero__eyebrow">챌린지 상세 / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>

          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}초 분량</span>
          </div>

          <div className="signal-panel">
            <span className="signal-panel__label">준비 상태</span>
            <strong>{readyHeadline(challenge)}</strong>
            <p>{readyDescription(challenge)}</p>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              챌린지 시작
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              기록 보러 가기
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>레퍼런스 준비 상태</h2>
              <p>이 챌린지가 실제 업로드 채점을 받을 준비가 되었는지 확인합니다.</p>
            </div>
          </div>

          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>분석</span>
              <strong>{analysisShortLabel(challenge.referenceAnalysisStatus)}</strong>
              <p>{analysisStatusLabel(challenge.referenceAnalysisStatus)}</p>
            </div>
            <div className="signal-grid__item">
              <span>레퍼런스 영상</span>
              <strong>{challenge.referenceVideoUploaded ? '업로드됨' : '없음'}</strong>
              <p>{challenge.referenceVideoUploaded ? '레퍼런스 영상이 등록되어 있습니다' : '레퍼런스 영상이 아직 없습니다'}</p>
            </div>
            <div className="signal-grid__item">
              <span>프로필</span>
              <strong>{challenge.referenceMotionProfileReady ? '준비 완료' : '생성 대기'}</strong>
              <p>{challenge.referenceMotionProfileReady ? '모션 프로필이 준비되었습니다' : '모션 프로필 생성을 기다리는 중입니다'}</p>
            </div>
            <div className="signal-grid__item">
              <span>최근 분석</span>
              <strong>{challenge.referenceAnalyzedAt ? '기록 있음' : '없음'}</strong>
              <p>{challenge.referenceAnalyzedAt ? new Date(challenge.referenceAnalyzedAt).toLocaleString('ko-KR') : '아직 분석 기록이 없습니다'}</p>
            </div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>진입 가이드</h2>
              <p>상세 화면에서 실제 채점 시도로 이어지는 순서를 안내합니다.</p>
            </div>
          </div>

          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 레퍼런스 준비 상태와 최근 재도전 흐름을 확인합니다</div>
            <div className="detail-flow__item">2. 시작 콘솔로 이동해 실제 시도 영상을 업로드합니다</div>
            <div className="detail-flow__item">3. 결과 페이지에서 이전 기록과 점수 변화를 비교합니다</div>
          </div>

          <ul className="detail-list">
            <li>
              <strong>가이드 영상</strong>
              {challenge.guideVideoUrl
                ? '가이드 영상이 연결되어 있어 다시 촬영하기 전에 목표 동작을 확인할 수 있습니다.'
                : '가이드 영상은 없지만 레퍼런스 준비 상태와 재도전 기록은 확인할 수 있습니다.'}
            </li>
            <li>
              <strong>추천 다음 단계</strong>
              {challenge.referenceMotionProfileReady
                ? '시작 콘솔로 이동해 같은 구도에서 새 업로드를 시도해 보세요.'
                : '실제 비교를 시작하기 전에 운영 허브에서 레퍼런스 분석을 먼저 완료해 주세요.'}
            </li>
          </ul>

          {challenge.guideVideoUrl ? (
            <a className="button-link button-link--secondary" href={challenge.guideVideoUrl} target="_blank" rel="noreferrer">
              가이드 영상 열기
            </a>
          ) : null}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--retry">
        <article className="panel panel--section challenge-start__retry-panel">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>최근 재도전 흐름</h2>
              <p>다음 시도를 시작하기 전에 가장 최근 자동 채점 결과를 확인합니다.</p>
            </div>
          </div>

          {recentRetry ? (
            <>
              <div className="challenge-start__retry-summary">
                <div>
                  <span>최근 점수</span>
                  <strong>{recentRetry.latestScore}점</strong>
                </div>
                <div>
                  <span>변화</span>
                  <strong className={buildDeltaToneClass(recentRetry.scoreDeltaFromPrevious)}>
                    {formatDelta(recentRetry.scoreDeltaFromPrevious)}
                  </strong>
                </div>
                <div>
                  <span>집중 축</span>
                  <strong>{recentRetry.weakestArea ? toAttemptBreakdownLabel(recentRetry.weakestArea) : '데이터 부족'}</strong>
                </div>
              </div>

              <ul className="detail-list challenge-start__retry-list">
                <li>
                  <strong>재도전 메모</strong>
                  {buildRetryNote(recentRetry.retryFocus, recentRetry.weakestArea)}
                </li>
                <li>
                  <strong>유지할 강점</strong>
                  {buildKeepStableNote(recentRetry.keepStableFocus, recentRetry.strongestArea)}
                </li>
                <li>
                  <strong>요약</strong>
                  {recentRetry.coachingTeaser ?? '최근 결과를 열어 전체 비교 요약을 확인해 주세요.'}
                </li>
                <li>
                  <strong>최근 기록</strong>
                  {formatAttemptedAt(recentRetry.latestAttemptedAt)}
                </li>
              </ul>

              <div className="inline-actions">
                <Link className="button-link button-link--secondary" to={`/attempts/${recentRetry.latestAttemptId}/result`}>
                  최근 결과 열기
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}/start`}>
                  이 챌린지 다시 도전
                </Link>
              </div>
            </>
          ) : (
            <div className="challenge-start__empty-state">
              <strong>아직 자동 채점 기록이 없습니다.</strong>
              <p>첫 업로드 기록이 쌓이면 이후 재도전의 기준점이 만들어집니다.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') return '레퍼런스 분석 완료';
  if (status === 'ANALYZING') return '레퍼런스 분석 진행 중';
  if (status === 'FAILED') return '레퍼런스 분석 실패';
  return '레퍼런스 분석 대기';
}

function analysisShortLabel(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') return '완료';
  if (status === 'ANALYZING') return '진행';
  if (status === 'FAILED') return '오류';
  return '대기';
}

function readyHeadline(challenge: Challenge) {
  if (challenge.referenceMotionProfileReady) return '이 챌린지는 실제 업로드 채점을 받을 준비가 되었습니다';
  if (challenge.referenceVideoUploaded) return '레퍼런스 영상은 업로드되었지만 분석이 끝나야 본격적인 채점이 가능합니다.';
  return '이 챌린지가 완전히 준비되기까지 레퍼런스 설정이 더 필요합니다';
}

function readyDescription(challenge: Challenge) {
  if (challenge.referenceMotionProfileReady) return '시작 콘솔에서 실제 시도 영상을 업로드하고 저장된 레퍼런스 프로필과 비교해 보세요.';
  return '지금은 메타데이터만 확인할 수 있으며 실제 채점은 레퍼런스 프로필이 준비된 뒤 시작됩니다.';
}

function buildRetryNote(retryFocus: string | null, weakestArea: ChallengeBreakdownArea | null) {
  if (retryFocus) return retryFocus;
  if (weakestArea) return `${toAttemptBreakdownLabel(weakestArea)}부터 먼저 맞추면 다음 재도전 목표가 더 분명해집니다.`;
  return '최근 결과 가이드가 아직 제한적입니다. 같은 환경으로 한 번 더 촬영해 보세요.';
}

function buildKeepStableNote(keepStableFocus: string | null, strongestArea: ChallengeBreakdownArea | null) {
  if (keepStableFocus) return keepStableFocus;
  if (strongestArea) return `${toAttemptBreakdownLabel(strongestArea)}은 유지해서 다음 재도전에서도 같은 강점이 사라지지 않게 해 주세요.`;
  return '구도, 조명, 거리를 한 번에 바꾸지 말고 최대한 같은 조건을 유지해 주세요.';
}

function buildDeltaToneClass(delta: number | null) {
  if (delta == null || delta === 0) return '';
  return delta > 0 ? 'challenge-start__trend challenge-start__trend--up' : 'challenge-start__trend challenge-start__trend--down';
}

function formatDelta(delta: number | null) {
  if (delta == null) return '기준 기록';
  if (delta === 0) return '변화 없음';
  return `${delta > 0 ? '+' : ''}${delta}점`;
}

function formatAttemptedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

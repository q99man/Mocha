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
          setError(loadError instanceof Error ? loadError.message : '챌린지 시작 콘솔을 불러오지 못했습니다.');
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
            <h2>챌린지 시작 콘솔을 불러오는 중입니다</h2>
            <p>카메라 흐름, 업로드 흐름, 재도전 맥락을 확인하고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">오류</span>
          <div>
            <h2>챌린지 시작 콘솔을 표시할 수 없습니다</h2>
            <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          챌린지 목록으로 돌아가기
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
          <span className="section-heading__code">잠금</span>
          <div>
            <h2>이 챌린지는 아직 실제 시도를 받을 준비가 되지 않았습니다</h2>
            <p>실제 레퍼런스 영상과 모션 프로필이 준비된 챌린지에서만 채점 업로드를 받을 수 있습니다.</p>
          </div>
        </div>

        <ul className="detail-list">
          <li>
            <strong>레퍼런스 영상</strong>
            {challenge.referenceVideoUploaded ? '업로드됨' : '없음'}
          </li>
          <li>
            <strong>모션 프로필</strong>
            {challenge.referenceMotionProfileReady ? '준비 완료' : '대기 중'}
          </li>
          <li>
            <strong>분석 상태</strong>
            {challenge.referenceAnalysisStatus}
          </li>
        </ul>

        <div className="inline-actions">
          <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
            챌린지 상세 보기
          </Link>
          <Link className="button-link button-link--secondary" to="/admin/model-assets">
            운영 허브 열기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">시작 콘솔 / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>이 화면에서 장치 연결 상태를 확인하고 실제 시도 영상을 업로드한 뒤 바로 채점 결과 흐름으로 이동할 수 있습니다.</p>

          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}초</span>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>레퍼런스</span>
              <strong>{analysisStatusLabel(challenge.referenceAnalysisStatus)}</strong>
              <p>레퍼런스 분석 상태</p>
            </div>
            <div className="signal-grid__item">
              <span>채점</span>
              <strong>준비 완료</strong>
              <p>실제 업로드 채점이 가능합니다</p>
            </div>
            <div className="signal-grid__item">
              <span>최근 점수</span>
              <strong>{recentRetry ? `${recentRetry.latestScore}점` : '없음'}</strong>
              <p>{buildLastScoreCaption(recentRetry?.scoreDeltaFromPrevious ?? null, !!recentRetry)}</p>
            </div>
          </div>

          <div className="signal-panel">
            <span className="signal-panel__label">흐름 가이드</span>
            <strong>장치 확인 / 업로드 / 결과 검토</strong>
            <p>이 콘솔은 프로토타입 전용 흐름이 아니라 실제 업로드 채점 루프에 맞춰져 있습니다.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>이 화면에서 할 수 있는 일</h2>
              <p>화면을 벗어나지 않고 준비 단계에서 실제 채점 업로드까지 진행할 수 있습니다.</p>
            </div>
          </div>

          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 카메라 권한과 장치 연결 상태를 확인합니다</div>
            <div className="detail-flow__item">2. 실제 시도 영상을 업로드합니다</div>
            <div className="detail-flow__item">3. 결과 페이지에서 점수 분해를 확인합니다</div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>현재 준비 상태</h2>
              <p>이 챌린지는 이미 실제 레퍼런스 영상과 완료된 모션 프로필을 갖추고 있습니다.</p>
            </div>
          </div>

          <ul className="detail-list">
            <li>
              <strong>레퍼런스 분석</strong>
              {analysisStatusDescription(challenge.referenceAnalysisStatus)}
            </li>
            <li>
              <strong>모션 프로필</strong>
              준비 완료. 백엔드에서 업로드 영상을 레퍼런스 프로필과 비교할 수 있습니다.
            </li>
            <li>
              <strong>추천 다음 단계</strong>
              같은 카메라 환경을 유지한 채 새 시도를 업로드하면 다음 점수 변화를 읽기 쉬워집니다.
            </li>
          </ul>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              챌린지 상세로 돌아가기
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              챌린지 기록 보기
            </Link>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--retry">
        <article className="panel panel--section challenge-start__retry-panel">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>최근 재도전 힌트</h2>
              <p>새 시도를 업로드하기 전에 가장 최근 자동 채점 기록을 확인합니다.</p>
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
                  {recentRetry.coachingTeaser ?? '결과 페이지에서 전체 재도전 비교 내용을 확인해 주세요.'}
                </li>
                <li>
                  <strong>최근 기록 시각</strong>
                  {formatAttemptedAt(recentRetry.latestAttemptedAt)}
                </li>
              </ul>

              <div className="inline-actions">
                <Link className="button-link button-link--secondary" to={`/attempts/${recentRetry.latestAttemptId}/result`}>
                  최근 결과 열기
                </Link>
                <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
                  챌린지 기록 보기
                </Link>
              </div>
            </>
          ) : (
            <div className="challenge-start__empty-state">
              <strong>아직 자동 채점 시도 기록이 없습니다.</strong>
              <p>첫 업로드 기록이 쌓이면 이후 모든 재도전의 기준점이 생깁니다.</p>
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
    case 'COMPLETED': return '준비 완료';
    case 'ANALYZING': return '진행 중';
    case 'FAILED': return '실패';
    default: return '대기 중';
  }
}

function analysisStatusDescription(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED': return '레퍼런스 분석이 완료되어 채점 흐름에 바로 사용할 수 있습니다.';
    case 'ANALYZING': return '레퍼런스 분석이 진행 중입니다. 새 업로드 채점은 프로필 생성이 끝난 뒤 시작해 주세요.';
    case 'FAILED': return '레퍼런스 분석이 실패했습니다. 운영 허브에서 다시 실행해 주세요.';
    default: return '레퍼런스 분석이 아직 시작되지 않았습니다.';
  }
}

function buildLastScoreCaption(delta: number | null, hasRetry: boolean) {
  if (!hasRetry) return '아직 자동 채점 재도전 기록이 없습니다';
  if (delta == null) return '첫 채점 기록이 기준점으로 저장되었습니다';
  if (delta > 0) return `이전 재도전보다 ${delta}점 올랐습니다`;
  if (delta < 0) return `이전 재도전보다 ${Math.abs(delta)}점 내려갔습니다`;
  return '최근 재도전 점수가 이전과 같습니다';
}

function buildRetryNote(retryFocus: string | null, weakestArea: ChallengeBreakdownArea | null) {
  if (retryFocus) return retryFocus;
  if (weakestArea) return `${toAttemptBreakdownLabel(weakestArea)}부터 먼저 맞추면 다음 재도전 목표가 더 분명해집니다.`;
  return '환경을 최대한 그대로 유지한 채 한 번 더 촬영해 보세요.';
}

function buildKeepStableNote(keepStableFocus: string | null, strongestArea: ChallengeBreakdownArea | null) {
  if (keepStableFocus) return keepStableFocus;
  if (strongestArea) return `${toAttemptBreakdownLabel(strongestArea)}은 유지해서 다음 재도전에서도 같은 강점이 사라지지 않게 해 주세요.`;
  return '다음 재도전도 쉽게 비교할 수 있도록 카메라 환경과 조명을 최대한 일정하게 유지해 주세요.';
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

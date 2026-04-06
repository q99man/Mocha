import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getChallengeById } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

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
        const response = await getChallengeById(id);
        if (active) {
          setChallenge(response);
        }
      } catch (loadError) {
        if (active) {
          setChallenge(null);
          setError(loadError instanceof Error ? loadError.message : '챌린지 정보를 불러오지 못했습니다.');
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
            <h2>챌린지 상세 정보를 불러오는 중입니다</h2>
            <p>선택한 모션의 메타 데이터와 준비 상태를 정리하고 있습니다.</p>
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
            <h2>챌린지 정보를 확인할 수 없습니다</h2>
            <p>{error}</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          목록으로 돌아가기
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
            <h2>챌린지를 찾을 수 없습니다</h2>
            <p>선택한 챌린지가 존재하지 않거나 현재 비활성 상태입니다.</p>
          </div>
        </div>
        <Link className="button-link" to="/challenges">
          목록으로 돌아가기
        </Link>
      </section>
    );
  }

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
            <span className="pill">{challenge.durationSec}초 플레이</span>
          </div>

          <div className="signal-panel">
            <span className="signal-panel__label">READY STATUS</span>
            <strong>{readyHeadline(challenge)}</strong>
            <p>{readyDescription(challenge)}</p>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              도전 시작
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>시스템 판독</h2>
              <p>실제 업로드 기반 흐름으로 바로 이어질 수 있는지 빠르게 읽는 영역입니다.</p>
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
              <p>{challenge.referenceVideoUploaded ? '레퍼런스 비디오 업로드 완료' : '레퍼런스 비디오 업로드 전'}</p>
            </div>
            <div className="signal-grid__item">
              <span>PROFILE</span>
              <strong>{challenge.referenceMotionProfileReady ? 'READY' : 'PENDING'}</strong>
              <p>{challenge.referenceMotionProfileReady ? '모션 프로필 준비 완료' : '분석 완료 전'}</p>
            </div>
            <div className="signal-grid__item">
              <span>LAST SCAN</span>
              <strong>{challenge.referenceAnalyzedAt ? 'LOGGED' : 'NONE'}</strong>
              <p>{challenge.referenceAnalyzedAt ? new Date(challenge.referenceAnalyzedAt).toLocaleString('ko-KR') : '아직 분석 이력 없음'}</p>
            </div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>진입 가이드</h2>
              <p>지금 이 챌린지를 어떤 방식으로 확인하면 좋은지 정리합니다.</p>
            </div>
          </div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 준비 상태를 확인하고 시작 화면으로 이동</div>
            <div className="detail-flow__item">2. 카메라 권한 또는 비디오 업로드 흐름 선택</div>
            <div className="detail-flow__item">3. 결과 화면에서 점수와 헤드라인 판독</div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>가이드 영상</strong>
              {challenge.guideVideoUrl ? '가이드 영상을 별도 탭으로 열어 동작 흐름을 먼저 확인할 수 있습니다.' : '아직 연결된 가이드 영상은 없지만, 준비/결과 흐름은 먼저 확인할 수 있습니다.'}
            </li>
            <li>
              <strong>현재 추천</strong>
              {challenge.referenceMotionProfileReady ? '시작 화면에서 실제 업로드 기반 자동 채점 흐름을 바로 확인해 보세요.' : '레퍼런스 분석이 끝나기 전이라도 시작 화면에서 준비 기록과 샘플 결과 흐름을 먼저 검증할 수 있습니다.'}
            </li>
          </ul>
          {challenge.guideVideoUrl ? (
            <a className="button-link button-link--secondary" href={challenge.guideVideoUrl} target="_blank" rel="noreferrer">
              가이드 영상 열기
            </a>
          ) : null}
        </article>
      </section>
    </div>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return '레퍼런스 분석 완료';
    case 'ANALYZING':
      return '레퍼런스 분석 중';
    case 'FAILED':
      return '레퍼런스 분석 실패';
    default:
      return '레퍼런스 분석 전';
  }
}

function analysisShortLabel(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return 'READY';
    case 'ANALYZING':
      return 'SCAN';
    case 'FAILED':
      return 'ERROR';
    default:
      return 'WAIT';
  }
}

function readyHeadline(challenge: Challenge): string {
  if (challenge.referenceMotionProfileReady) {
    return '이 챌린지는 업로드 기반 자동 채점 흐름까지 바로 확인할 수 있습니다.';
  }

  if (challenge.referenceVideoUploaded) {
    return '레퍼런스 비디오는 올라가 있지만, 분석 완료 전이라 실제 채점 흐름은 제한될 수 있습니다.';
  }

  return '현재는 준비 흐름과 샘플 결과 중심으로 먼저 검증하는 챌린지입니다.';
}

function readyDescription(challenge: Challenge): string {
  if (challenge.referenceMotionProfileReady) {
    return '시작 화면에서 카메라 준비 또는 시도 비디오 업로드 후 결과 화면까지 연결해 볼 수 있습니다.';
  }

  return '실제 업로드 자동 채점이 제한되더라도 준비 상태 저장, 샘플 완료 결과 저장, 결과 화면 검증은 그대로 진행할 수 있습니다.';
}

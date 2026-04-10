import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CameraPermissionPanel } from '../features/motion/CameraPermissionPanel';
import { getChallengeById } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

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
        const response = await getChallengeById(id);
        if (active) {
          setChallenge(response);
        }
      } catch (loadError) {
        if (active) {
          setChallenge(null);
          setError(loadError instanceof Error ? loadError.message : '도전 준비 화면을 불러오지 못했습니다.');
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
            <h2>도전 준비 화면을 불러오는 중입니다</h2>
            <p>카메라 준비와 업로드 흐름을 정리하고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">ERROR</span>
          <div>
            <h2>도전 준비 화면을 열 수 없습니다</h2>
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

  if (!challengeReady) {
    return (
      <section className="panel panel--error panel--section">
        <div className="section-heading">
          <span className="section-heading__code">LOCK</span>
          <div>
            <h2>아직 도전할 수 없는 챌린지입니다</h2>
            <p>실제 레퍼런스 영상 업로드와 레퍼런스 분석이 모두 완료된 챌린지만 도전 가능합니다.</p>
          </div>
        </div>
        <ul className="detail-list">
          <li>
            <strong>reference video</strong>
            {challenge.referenceVideoUploaded ? '업로드 완료' : '업로드 전'}
          </li>
          <li>
            <strong>motion profile</strong>
            {challenge.referenceMotionProfileReady ? '준비 완료' : '준비 전'}
          </li>
          <li>
            <strong>analysis status</strong>
            {challenge.referenceAnalysisStatus}
          </li>
        </ul>
        <div className="inline-actions">
          <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
            챌린지 상세로 돌아가기
          </Link>
          <Link className="button-link button-link--secondary" to="/admin/model-assets">
            운영 화면 열기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">START CONSOLE / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>
            카메라 권한을 확인하고 실제 시도 영상을 업로드해 자동 채점 결과를 확인하는 시작 화면입니다.
          </p>
          <div className="challenge-card__meta">
            <span className="pill">{challenge.category}</span>
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}초</span>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>REFERENCE</span>
              <strong>{analysisStatusLabel(challenge.referenceAnalysisStatus)}</strong>
              <p>레퍼런스 비디오 분석 상태</p>
            </div>
            <div className="signal-grid__item">
              <span>SCORING</span>
              <strong>READY</strong>
              <p>실제 업로드 기반 자동 채점 가능</p>
            </div>
          </div>
          <div className="signal-panel">
            <span className="signal-panel__label">FLOW GUIDE</span>
            <strong>권한 확인 / 업로드 / 결과 확인</strong>
            <p>
              이 화면에서는 실제 업로드 자동 채점 흐름만 제공합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>이 화면에서 할 수 있는 일</h2>
              <p>실제 자동 채점 준비 상태를 확인하고 시도 영상을 업로드합니다.</p>
            </div>
          </div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 카메라 권한과 장치 상태 확인</div>
            <div className="detail-flow__item">2. 실제 시도 영상 업로드</div>
            <div className="detail-flow__item">3. 결과 화면에서 점수와 요약 확인</div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>현재 준비 상태</h2>
              <p>이 챌린지는 실제 레퍼런스 영상과 모션 프로필이 준비된 상태입니다.</p>
            </div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>레퍼런스 분석 상태</strong>
              {analysisStatusDescription(challenge.referenceAnalysisStatus)}
            </li>
            <li>
              <strong>모션 프로필 준비 여부</strong>
              준비 완료: 실제 업로드 기반 자동 채점 흐름을 사용할 수 있습니다.
            </li>
            <li>
              <strong>권장 진행 순서</strong>
              카메라 또는 파일 업로드 흐름으로 바로 시도해 보세요.
            </li>
          </ul>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              챌린지 상세로 돌아가기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 화면 보기
            </Link>
          </div>
        </article>
      </section>

      <CameraPermissionPanel challengeId={challenge.id} challengeTitle={challenge.title} />
    </div>
  );
}

function analysisStatusLabel(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return 'READY';
    case 'ANALYZING':
      return 'RUN';
    case 'FAILED':
      return 'FAIL';
    default:
      return 'WAIT';
  }
}

function analysisStatusDescription(status: Challenge['referenceAnalysisStatus']): string {
  switch (status) {
    case 'COMPLETED':
      return '레퍼런스 분석이 완료되어 자동 채점 흐름을 사용할 수 있습니다.';
    case 'ANALYZING':
      return '레퍼런스 비디오를 분석 중입니다. 완료 후 자동 채점 준비 상태가 갱신됩니다.';
    case 'FAILED':
      return '레퍼런스 분석에 실패했습니다. 운영 화면에서 다시 분석해 주세요.';
    default:
      return '레퍼런스 분석이 아직 실행되지 않았습니다.';
  }
}

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

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">START CONSOLE / CH-{String(challenge.id).padStart(2, '0')}</span>
          <h2>{challenge.title}</h2>
          <p>
            카메라 권한을 확인하고, 시도 영상을 업로드하거나 준비 기록을 남길 수 있는 시작 화면입니다.
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
              <strong>{challenge.referenceMotionProfileReady ? 'READY' : 'LIMIT'}</strong>
              <p>{challenge.referenceMotionProfileReady ? '업로드 기반 자동 채점 가능' : '샘플 흐름으로만 진행 가능'}</p>
            </div>
          </div>
          <div className="signal-panel">
            <span className="signal-panel__label">FLOW GUIDE</span>
            <strong>권한 확인 / 업로드 / 결과 확인</strong>
            <p>
              현재 MVP에서는 준비 저장, 샘플 완료 저장, 실제 영상 업로드 자동 채점 흐름을 모두 이 화면에서 확인할 수 있습니다.
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
              <p>실제 자동 채점 준비 상태와 프로토타입 저장 흐름을 한 번에 확인합니다.</p>
            </div>
          </div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 카메라 권한과 장치 상태 확인</div>
            <div className="detail-flow__item">2. 준비 기록 또는 샘플 완료 기록 저장</div>
            <div className="detail-flow__item">3. 시도 영상 업로드와 결과 확인</div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>현재 준비 상태</h2>
              <p>레퍼런스 분석 준비 상태에 따라 실제 업로드 흐름 가능 여부가 달라집니다.</p>
            </div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>레퍼런스 분석 상태</strong>
              {analysisStatusDescription(challenge.referenceAnalysisStatus)}
            </li>
            <li>
              <strong>모션 프로필 준비 여부</strong>
              {challenge.referenceMotionProfileReady
                ? '준비 완료: 실제 업로드 기반 자동 채점 흐름을 사용할 수 있습니다.'
                : '준비 전: 준비 저장 또는 샘플 결과 흐름만 확인할 수 있습니다.'}
            </li>
            <li>
              <strong>권장 진행 순서</strong>
              {challenge.referenceMotionProfileReady
                ? '카메라 또는 파일 업로드 흐름으로 바로 시도해 보세요.'
                : '준비 상태 저장이나 샘플 완료 결과를 먼저 확인해 보세요.'}
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
      return '레퍼런스 분석에 실패했습니다. 다시 분석하거나 준비 흐름으로 먼저 검증해 보세요.';
    default:
      return '레퍼런스 분석이 아직 실행되지 않았습니다.';
  }
}

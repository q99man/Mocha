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
          setError(loadError instanceof Error ? loadError.message : '도전 준비 정보를 불러오지 못했습니다.');
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
            <p>카메라, 업로드, 결과 진입 경로를 구성하고 있습니다.</p>
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
          챌린지 목록으로 이동
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
            카메라 권한을 점검하고, 업로드 기반 자동 채점 또는 준비 기록 저장 흐름으로 이어질 수 있는 시작 콘솔입니다.
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
              <span>CAMERA</span>
              <strong>CHECK</strong>
              <p>권한 및 장치 상태 확인</p>
            </div>
            <div className="signal-grid__item">
              <span>UPLOAD</span>
              <strong>{challenge.referenceMotionProfileReady ? 'LIVE' : 'LIMIT'}</strong>
              <p>{challenge.referenceMotionProfileReady ? '자동 채점 흐름 연결 가능' : '샘플 흐름 중심 확인'}</p>
            </div>
          </div>
          <div className="signal-panel">
            <span className="signal-panel__label">FLOW GUIDE</span>
            <strong>READY / RECORD / RESULT</strong>
            <p>실시간 녹화 HUD는 아직 placeholder지만, 준비 콘솔과 결과 흐름은 이미 하나로 연결되어 있습니다.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>이번 화면에서 확인할 것</h2>
              <p>현재 시작 화면은 실제 카메라 사용 여부와 무관하게 데모 흐름을 검증하는 데 목적이 있습니다.</p>
            </div>
          </div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 카메라 권한 및 장치 상태 확인</div>
            <div className="detail-flow__item">2. 업로드 기반 자동 채점 또는 샘플 저장 선택</div>
            <div className="detail-flow__item">3. 결과 화면에서 점수와 상태 확인</div>
          </div>
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>현재 준비 수준</h2>
              <p>레퍼런스 분석 준비 상태에 따라 실제 업로드 흐름 가능 여부가 달라집니다.</p>
            </div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>레퍼런스 분석 상태</strong>
              {analysisStatusLabel(challenge.referenceAnalysisStatus)}
            </li>
            <li>
              <strong>모션 프로필 준비</strong>
              {challenge.referenceMotionProfileReady ? '준비 완료: 실제 업로드 기반 점수 흐름 확인 가능' : '준비 전: 샘플 결과 중심으로 먼저 흐름 확인'}
            </li>
            <li>
              <strong>추천 액션</strong>
              {challenge.referenceMotionProfileReady ? '카메라 준비 후 시도 비디오 업로드를 먼저 확인해 보세요.' : '준비 상태 저장 또는 샘플 완료 결과 저장으로 결과 구조부터 검증해 보세요.'}
            </li>
          </ul>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              상세로 돌아가기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 보기
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
      return '레퍼런스 분석 완료';
    case 'ANALYZING':
      return '레퍼런스 분석 중';
    case 'FAILED':
      return '레퍼런스 분석 실패';
    default:
      return '레퍼런스 분석 전';
  }
}

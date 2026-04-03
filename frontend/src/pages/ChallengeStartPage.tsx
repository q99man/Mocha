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
      <section className="panel">
        <p>도전 준비 화면을 불러오는 중입니다...</p>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="panel panel--error">
        <h2>도전 준비 화면을 열 수 없습니다</h2>
        <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
        <Link className="button-link" to="/challenges">
          챌린지 목록으로 이동
        </Link>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="panel">
        <span className="hero__eyebrow">도전 준비</span>
        <h2>{challenge.title}</h2>
        <p>
          카메라 권한을 확인하고, 준비 상태 저장 또는 시도 비디오 업로드 흐름을 바로 테스트해 보세요. 아직 브라우저 녹화는 없지만,
          실제 자동 채점 API까지 이어지는 MVP 경로를 확인할 수 있습니다.
        </p>
        <div className="stat-row">
          <div className="stat-card">
            <strong>카테고리</strong>
            <p>{challenge.category}</p>
          </div>
          <div className="stat-card">
            <strong>난이도</strong>
            <p>{challenge.difficulty}</p>
          </div>
          <div className="stat-card">
            <strong>진행 시간</strong>
            <p>{challenge.durationSec}초</p>
          </div>
        </div>
        <div className="detail-flow">
          <div className="detail-flow__item">1. 카메라 권한 확인</div>
          <div className="detail-flow__item">2. 준비 화면 또는 업로드 흐름 확인</div>
          <div className="detail-flow__item">3. 결과 화면으로 이동</div>
        </div>
        <div className="inline-actions">
          <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
            챌린지 상세로 돌아가기
          </Link>
          <Link className="button-link button-link--secondary" to="/attempts">
            저장된 기록 보기
          </Link>
        </div>
      </section>

      <CameraPermissionPanel challengeId={challenge.id} challengeTitle={challenge.title} />
    </div>
  );
}

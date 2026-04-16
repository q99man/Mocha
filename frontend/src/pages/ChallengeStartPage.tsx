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
          setError(loadError instanceof Error ? loadError.message : '챌린지 시작 정보를 불러오지 못했습니다.');
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
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>도전 준비 화면을 불러오는 중입니다.</strong>
          <p>카메라와 업로드 흐름을 준비하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>도전 화면을 열지 못했습니다.</strong>
          <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">
              목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const challengeReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
  const latestScore = challenge.latestRetrySummary ? `${challenge.latestRetrySummary.latestScore}점` : '기록 없음';

  if (!challengeReady) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>아직 바로 시작할 수 없는 챌린지입니다.</strong>
          <p>레퍼런스 영상과 모션 프로필 준비가 끝나야 실제 시도 업로드가 가능합니다.</p>
          <div className="glass-inline-meta">
            <span>영상 {challenge.referenceVideoUploaded ? '등록됨' : '없음'}</span>
            <span>프로필 {challenge.referenceMotionProfileReady ? '완료' : '대기'}</span>
            <span>분석 {challenge.referenceAnalysisStatus}</span>
          </div>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              상세 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">Start Challenge</span>
          <h2>{challenge.title}</h2>
          <p>준비 상태 확인은 최소화하고, 바로 촬영 또는 업로드에 집중할 수 있는 구조로 정리했습니다.</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>난이도</span>
            <strong>{challenge.difficulty}</strong>
          </div>
          <div>
            <span>길이</span>
            <strong>{challenge.durationSec}초</strong>
          </div>
          <div>
            <span>최근 점수</span>
            <strong>{latestScore}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-inline-meta">
          <span>{challenge.category}</span>
          <span>레퍼런스 {challenge.referenceAnalysisStatus}</span>
          <span>프로필 준비 완료</span>
        </div>
      </section>

      <CameraPermissionPanel challengeId={challenge.id} challengeTitle={challenge.title} />
    </div>
  );
}

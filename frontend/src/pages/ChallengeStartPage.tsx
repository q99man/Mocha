import { useEffect, useMemo, useState } from 'react';
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
          setError(loadError instanceof Error ? loadError.message : '챌린지 시작 화면을 불러오지 못했습니다.');
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

  const latestScoreLabel = useMemo(() => {
    if (!challenge?.latestRetrySummary) {
      return '기록 없음';
    }

    return `${challenge.latestRetrySummary.latestScore}점`;
  }, [challenge?.latestRetrySummary]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>시작 화면을 준비하는 중입니다.</strong>
          <p>챌린지 상태와 업로드 가능 여부를 확인하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 정보를 불러오지 못했습니다.</strong>
          <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">
              챌린지 목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const challengeReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;

  if (!challengeReady) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>아직 바로 시작할 수 없는 챌린지입니다.</strong>
          <p>레퍼런스 영상과 모션 프로필이 준비되어야 실제 시도 업로드를 시작할 수 있습니다.</p>

          <div className="glass-inline-meta">
            <span>레퍼런스 영상 {challenge.referenceVideoUploaded ? '준비됨' : '없음'}</span>
            <span>모션 프로필 {challenge.referenceMotionProfileReady ? '준비됨' : '대기'}</span>
            <span>분석 상태 {challenge.referenceAnalysisStatus}</span>
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
          <span className="glass-intro__eyebrow">챌린지 시작</span>
          <h2>{challenge.title}</h2>
          <p>준비 상태를 확인한 뒤 카메라 점검 또는 영상 업로드로 바로 이어지는 간결한 시작 흐름입니다.</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>난이도</span>
            <strong>{challenge.difficulty}</strong>
          </div>
          <div>
            <span>길이</span>
            <strong>{formatDurationLabel(challenge.durationSec)}</strong>
          </div>
          <div>
            <span>최근 점수</span>
            <strong>{latestScoreLabel}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-inline-meta">
          <span>{challenge.category}</span>
          <span>레퍼런스 {challenge.referenceAnalysisStatus}</span>
          <span>업로드 준비 완료</span>
        </div>
      </section>

      <CameraPermissionPanel challengeId={challenge.id} challengeTitle={challenge.title} />
    </div>
  );
}

function formatDurationLabel(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}초`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (seconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChallengeReferencePosePreview } from '../features/challenges/ChallengeReferencePosePreview';
import { getAdminChallengeById, getAdminChallengeReferencePreview } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

export function AdminChallengeAnalysisPage() {
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
        const challengeResponse = await getAdminChallengeById(id);
        if (active) {
          setChallenge(challengeResponse);
        }
      } catch (loadError) {
        if (active) {
          setChallenge(null);
          setError(loadError instanceof Error ? loadError.message : '운영 분석 상세 화면을 불러오지 못했습니다.');
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
          <strong>분석 상세를 불러오는 중입니다.</strong>
          <p>레퍼런스 영상과 포즈 오버레이 정보를 수집하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>분석 상세를 불러오지 못했습니다.</strong>
          <p>{error}</p>
          <div className="inline-actions">
            <Link className="button-link" to="/admin/model-assets">
              운영 허브로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지를 찾을 수 없습니다.</strong>
          <p>선택한 분석 대상이 더 이상 존재하지 않거나 접근할 수 없습니다.</p>
          <div className="inline-actions">
            <Link className="button-link" to="/admin/model-assets">
              운영 허브로
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
          <span className="glass-intro__eyebrow">운영 분석</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>카테고리</span>
            <strong>{challenge.category}</strong>
          </div>
          <div>
            <span>난이도</span>
            <strong>{challenge.difficulty}</strong>
          </div>
          <div>
            <span>상태</span>
            <strong>{challenge.referenceMotionProfileReady ? '준비 완료' : '대기 중'}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div className="glass-inline-meta">
            <span>레퍼런스 {challenge.referenceAnalysisStatus}</span>
            <span>{challenge.durationSec}초</span>
            <span>{challenge.referenceMotionProfileReady ? '오버레이 확인 가능' : '오버레이 준비 중'}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges?challengeId=${challenge.id}`}>
              챌린지 보기
            </Link>
            <Link className="button-link" to="/admin/model-assets">
              운영 허브로
            </Link>
          </div>
        </div>
      </section>

      <ChallengeReferencePosePreview
        challengeId={challenge.id}
        challengeTitle={challenge.title}
        enabled={challenge.referenceMotionProfileReady}
        loadPreview={getAdminChallengeReferencePreview}
      />
    </div>
  );
}

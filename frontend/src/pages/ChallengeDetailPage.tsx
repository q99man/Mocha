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
      <section className="panel">
        <p>챌린지 상세 정보를 불러오는 중입니다...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel--error">
        <h2>챌린지 정보를 확인할 수 없습니다</h2>
        <p>{error}</p>
        <Link className="button-link" to="/challenges">
          목록으로 돌아가기
        </Link>
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="panel">
        <h2>챌린지를 찾을 수 없습니다</h2>
        <p>선택한 챌린지가 존재하지 않거나 현재 비활성 상태입니다.</p>
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
            <div className="hero__image hero__image--placeholder">썸네일 준비 중</div>
          )}
        </div>
        <div className="hero__content">
          <span className="hero__eyebrow">{challenge.category}</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>
          <div className="challenge-card__meta">
            <span className="pill">{challenge.difficulty}</span>
            <span className="pill">{challenge.durationSec}초 진행</span>
            <span className="pill">{analysisStatusLabel(challenge.referenceAnalysisStatus)}</span>
          </div>
          <div className="detail-list">
            <div>
              <strong>레퍼런스 비디오</strong>
              <span>{challenge.referenceVideoUploaded ? '업로드 완료' : '업로드 전'}</span>
            </div>
            <div>
              <strong>모션 프로필</strong>
              <span>{challenge.referenceMotionProfileReady ? '준비 완료' : '아직 준비되지 않음'}</span>
            </div>
            {challenge.referenceAnalyzedAt ? (
              <div>
                <strong>마지막 분석 시각</strong>
                <span>{new Date(challenge.referenceAnalyzedAt).toLocaleString('ko-KR')}</span>
              </div>
            ) : null}
          </div>
          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              도전 시작하기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              도전 기록 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>가이드</h2>
        {challenge.guideVideoUrl ? (
          <a href={challenge.guideVideoUrl} target="_blank" rel="noreferrer">
            가이드 영상 열기
          </a>
        ) : (
          <p>아직 연결된 가이드 영상은 없습니다. 추후 이 영역에 데모 영상이나 스토리보드가 표시될 수 있습니다.</p>
        )}
      </section>

      {!challenge.referenceMotionProfileReady ? (
        <section className="panel">
          <h2>도전 시작 전 확인</h2>
          <p>
            이 챌린지는 아직 레퍼런스 분석이 끝나지 않아 실제 비디오 업로드 자동 채점은 제한될 수 있습니다. 그래도 준비 화면과 수동 저장 흐름은 먼저 확인할 수 있습니다.
          </p>
        </section>
      ) : null}
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

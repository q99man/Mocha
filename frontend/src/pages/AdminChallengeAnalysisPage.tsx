import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChallengeReferencePosePreview } from '../features/challenges/ChallengeReferencePosePreview';
import { formatDifficulty } from '../features/challenges/difficulty';
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

  const analysisSummary = useMemo(() => {
    if (!challenge) {
      return null;
    }

    return [
      {
        label: '레퍼런스 상태',
        value: toAnalysisStatusLabel(challenge.referenceAnalysisStatus),
      },
      {
        label: '포즈 프로필',
        value: challenge.referenceMotionProfileReady ? '준비 완료' : '대기 중',
      },
      {
        label: '최근 분석',
        value: challenge.referenceAnalyzedAt ? formatDateTimeFull(challenge.referenceAnalyzedAt) : '기록 없음',
      },
      {
        label: '영상 길이',
        value: `${challenge.durationSec}초`,
      },
    ];
  }, [challenge]);

  if (loading) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="glass-panel glass-panel--empty">
            <strong>분석 상세를 불러오는 중입니다.</strong>
            <p>레퍼런스 영상과 포즈 오버레이 정보를 정리하고 있습니다.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="glass-panel glass-panel--empty">
            <strong>분석 상세를 불러오지 못했습니다.</strong>
            <p>{error}</p>
            <div className="inline-actions">
              <Link className="button-link button-link--compact" to="/admin/model-assets">
                운영 허브로
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!challenge || !analysisSummary) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="glass-panel glass-panel--empty">
            <strong>챌린지를 찾을 수 없습니다.</strong>
            <p>선택한 분석 대상이 더 이상 존재하지 않거나 접근할 수 없습니다.</p>
            <div className="inline-actions">
              <Link className="button-link button-link--compact" to="/admin/model-assets">
                운영 허브로
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact admin-analysis-compact">
        <div className="board-detail-compact__toolbar mypage-compact-header">
          <div>
            <h2 className="board-classic-title">{challenge.title}</h2>
            <p className="board-classic-summary">레퍼런스 분석 결과와 포즈 오버레이를 한 화면에서 빠르게 확인합니다.</p>
          </div>

          <div className="inline-actions">
            <Link
              className="button-link button-link--secondary button-link--compact"
              to={`/challenges?challengeId=${challenge.id}`}
            >
              챌린지 보기
            </Link>
            <Link className="button-link button-link--compact" to="/admin/model-assets">
              운영 허브로
            </Link>
          </div>
        </div>

        <div className="glass-chip-group mypage-compact-tabs admin-hub-compact__chips">
          <span className="glass-chip is-active">난이도 {formatDifficulty(challenge.difficulty)}</span>
          <span className="glass-chip">{challenge.category}</span>
          <span className="glass-chip">{challenge.referenceVideoUploaded ? '레퍼런스 등록됨' : '레퍼런스 없음'}</span>
          <span className="glass-chip">
            {challenge.referenceMotionProfileReady ? '오버레이 확인 가능' : '오버레이 준비 중'}
          </span>
        </div>

        <section className="glass-panel glass-panel--nested admin-hub-compact__section">
          <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
            <div>
              <h3 className="glass-section-title">분석 요약</h3>
              <p className="glass-toolbar__note">{challenge.description || '등록된 챌린지 설명이 없습니다.'}</p>
            </div>
          </div>

          <div className="admin-analysis-compact__headline-grid">
            {analysisSummary.map((item) => (
              <div className="admin-analysis-compact__headline-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="admin-analysis-compact__summary-grid">
            <div className="admin-analysis-compact__summary-card">
              <span>레퍼런스 파일</span>
              <strong>{challenge.referenceVideoOriginalFileName ?? '등록된 파일이 없습니다.'}</strong>
            </div>
            <div className="admin-analysis-compact__summary-card">
              <span>가이드 영상</span>
              <strong>{challenge.guideVideoUrl ?? '연결된 URL이 없습니다.'}</strong>
            </div>
            <div className="admin-analysis-compact__summary-card">
              <span>썸네일</span>
              <strong>{challenge.thumbnailUrl ?? '연결된 URL이 없습니다.'}</strong>
            </div>
            <div className="admin-analysis-compact__summary-card">
              <span>미리보기 상태</span>
              <strong>{challenge.referenceMotionProfileReady ? '영상과 포즈를 함께 확인할 수 있습니다.' : '분석 완료 후 미리보기를 확인할 수 있습니다.'}</strong>
            </div>
          </div>

          {challenge.latestRetrySummary ? (
            <div className="admin-analysis-compact__result-grid">
              <div className="admin-analysis-compact__result-card">
                <span>최근 점수</span>
                <strong>{challenge.latestRetrySummary.latestScore}점</strong>
              </div>
              <div className="admin-analysis-compact__result-card">
                <span>최근 도전</span>
                <strong>{formatDateTimeFull(challenge.latestRetrySummary.latestAttemptedAt)}</strong>
              </div>
              <div className="admin-analysis-compact__result-card">
                <span>강점</span>
                <strong>{toAreaLabel(challenge.latestRetrySummary.strongestArea, '데이터 없음')}</strong>
              </div>
              <div className="admin-analysis-compact__result-card">
                <span>보완</span>
                <strong>{toAreaLabel(challenge.latestRetrySummary.weakestArea, '데이터 없음')}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <section className="glass-panel glass-panel--nested admin-hub-compact__section admin-analysis-compact__preview-shell">
          <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
            <div>
              <h3 className="glass-section-title">포즈 오버레이 미리보기</h3>
              <p className="glass-toolbar__note">레퍼런스 영상 위에 추출된 포즈 흐름을 겹쳐서 분석 상태를 바로 확인합니다.</p>
            </div>
          </div>

          <ChallengeReferencePosePreview
            challengeId={challenge.id}
            challengeTitle={challenge.title}
            enabled={challenge.referenceMotionProfileReady}
            loadPreview={getAdminChallengeReferencePreview}
          />
        </section>
      </section>
    </div>
  );
}

function toAnalysisStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return '대기';
    case 'PROCESSING':
      return '처리 중';
    case 'READY':
      return '준비 완료';
    case 'FAILED':
      return '실패';
    default:
      return status;
  }
}

function toAreaLabel(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  switch (value) {
    case 'pose shape':
      return '포즈 형태';
    case 'pose timing':
      return '포즈 타이밍';
    case 'detection quality':
      return '감지 안정성';
    default:
      return value;
  }
}

function formatDateTimeFull(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

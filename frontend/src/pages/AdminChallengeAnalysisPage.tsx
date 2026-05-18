import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChallengeReferencePosePreview } from '../features/challenges/ChallengeReferencePosePreview';
import { formatDifficulty } from '../features/challenges/difficulty';
import { getAdminChallengeById, getAdminChallengeReferencePreview } from '../shared/api/challengeApi';
import { formatFullDateTime as formatDateTimeFull } from '../shared/presentation/dateTime';
import type { Challenge } from '../shared/types/challenge';

type SummaryItem = {
  label: string;
  value: string;
};

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
          setError(loadError instanceof Error ? loadError.message : '분석 화면을 불러오지 못했습니다.');
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

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (!challenge) {
      return [];
    }

    const items: SummaryItem[] = [
      { label: '분석 상태', value: toAnalysisStatusLabel(challenge.referenceAnalysisStatus) },
      { label: '난이도', value: formatDifficulty(challenge.difficulty) },
      { label: '길이', value: `${challenge.durationSec}초` },
      {
        label: '레퍼런스 파일',
        value: challenge.referenceVideoOriginalFileName ?? '등록된 파일이 없습니다.',
      },
      {
        label: '최근 분석',
        value: challenge.referenceAnalyzedAt ? formatDateTimeFull(challenge.referenceAnalyzedAt) : '아직 분석되지 않았습니다.',
      },
    ];

    if (challenge.guideVideoUrl) {
      items.push({ label: '가이드 영상', value: challenge.guideVideoUrl });
    }

    if (challenge.thumbnailUrl) {
      items.push({ label: '썸네일', value: challenge.thumbnailUrl });
    }

    if (challenge.latestRetrySummary) {
      items.push({
        label: '최근 플레이',
        value: `${challenge.latestRetrySummary.latestScore}점 · ${formatDateTimeFull(challenge.latestRetrySummary.latestAttemptedAt)}`,
      });
      items.push({
        label: '결과 요약',
        value: `강점 ${toAreaLabel(challenge.latestRetrySummary.strongestArea, '데이터 없음')} / 보완 ${toAreaLabel(
          challenge.latestRetrySummary.weakestArea,
          '데이터 없음',
        )}`,
      });
    }

    return items;
  }, [challenge]);

  if (loading) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="glass-panel glass-panel--empty">
            <strong>분석 화면을 불러오는 중입니다.</strong>
            <p>레퍼런스 영상과 포즈 미리보기를 준비하고 있습니다.</p>
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
            <strong>분석 화면을 불러오지 못했습니다.</strong>
            <p>{error}</p>
            <div className="inline-actions">
              <Link className="button-link button-link--compact" to="/admin?tab=challenges">
                운영 허브로
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="glass-panel glass-panel--empty">
            <strong>챌린지를 찾을 수 없습니다.</strong>
            <p>선택한 분석 대상이 없거나 이미 정리되었습니다.</p>
            <div className="inline-actions">
              <Link className="button-link button-link--compact" to="/admin?tab=challenges">
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
            <p className="board-classic-summary">{challenge.description || '등록된 설명이 없습니다.'}</p>
          </div>

          <div className="inline-actions">
            <Link
              className="button-link button-link--secondary button-link--compact"
              to={`/challenges?challengeId=${challenge.id}`}
            >
              챌린지 보기
            </Link>
            <Link className="button-link button-link--compact" to="/admin?tab=challenges">
              운영 허브로
            </Link>
          </div>
        </div>

        <div className="glass-chip-group mypage-compact-tabs admin-hub-compact__chips admin-analysis-compact__meta">
          <span className="glass-chip admin-analysis-compact__meta-chip is-active">{formatDifficulty(challenge.difficulty)}</span>
          <span className="glass-chip admin-analysis-compact__meta-chip">{challenge.category}</span>
          <span className="glass-chip admin-analysis-compact__meta-chip">{toAnalysisStatusLabel(challenge.referenceAnalysisStatus)}</span>
          <span className="glass-chip admin-analysis-compact__meta-chip">
            {challenge.referenceMotionProfileReady ? '미리보기 가능' : '미리보기 대기'}
          </span>
        </div>

        <section className="glass-panel glass-panel--nested admin-hub-compact__section">
          <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
            <div>
              <h3 className="glass-section-title">분석 요약</h3>
              <p className="glass-toolbar__note">중복 없이 필요한 정보만 바로 확인할 수 있게 정리했습니다.</p>
            </div>
          </div>

          <div className="admin-analysis-compact__list">
            {summaryItems.map((item) => (
              <div className="admin-analysis-compact__item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel glass-panel--nested admin-hub-compact__section admin-analysis-compact__preview-shell">
          <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
            <div>
              <h3 className="glass-section-title">포즈 미리보기</h3>
              <p className="glass-toolbar__note">레퍼런스 영상에서 추출한 포즈를 바로 확인합니다.</p>
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
    case 'NOT_ANALYZED':
      return '미분석';
    case 'ANALYZING':
      return '분석 중';
    case 'COMPLETED':
      return '분석 완료';
    case 'FAILED':
      return '실패';
    case 'PENDING':
      return '대기';
    case 'PROCESSING':
      return '처리 중';
    case 'READY':
      return '준비 완료';
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


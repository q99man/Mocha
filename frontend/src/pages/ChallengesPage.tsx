import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { Pagination } from '../shared/components/Pagination';
import { getChallenges } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

type ChallengeFilter = 'ALL' | 'READY' | 'REVIEWED';

const ITEMS_PER_PAGE = 6;

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadChallenges() {
      setLoading(true);
      setError(null);

      try {
        const response = await getChallenges();
        if (active) {
          setChallenges(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '챌린지 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenges();
    return () => {
      active = false;
    };
  }, []);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as const, label: '전체', count: challenges.length },
      {
        key: 'READY' as const,
        label: '도전 가능',
        count: challenges.filter((challenge) => challenge.referenceMotionProfileReady).length,
      },
      {
        key: 'REVIEWED' as const,
        label: '후기 있음',
        count: challenges.filter((challenge) => Boolean(challenge.latestRetrySummary)).length,
      },
    ],
    [challenges],
  );

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (activeFilter === 'READY') {
        return challenge.referenceMotionProfileReady;
      }
      if (activeFilter === 'REVIEWED') {
        return Boolean(challenge.latestRetrySummary);
      }
      return true;
    });
  }, [activeFilter, challenges]);

  const totalPages = Math.max(1, Math.ceil(filteredChallenges.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedChallenges = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredChallenges.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredChallenges]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 목록을 불러오는 중입니다.</strong>
          <p>공개된 도전 리스트를 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 목록을 불러오지 못했습니다.</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">Challenge Library</span>
          <h2>도전할 챌린지를 빠르게 고르세요</h2>
          <p>한 화면에서 제목, 난이도, 준비 상태, 최근 반응만 보고 바로 상세나 시작으로 이동할 수 있게 간략화했습니다.</p>
        </div>
        <div className="glass-intro__meta">
          <div>
            <span>전체</span>
            <strong>{String(challenges.length).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>도전 가능</span>
            <strong>{String(filterOptions[1].count).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div className="glass-chip-group">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                className={`glass-chip${activeFilter === option.key ? ' is-active' : ''}`}
                type="button"
                onClick={() => setActiveFilter(option.key)}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
          <p className="glass-toolbar__note">
            {filteredChallenges.length}개의 챌린지
          </p>
        </div>

        {pagedChallenges.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>조건에 맞는 챌린지가 없습니다.</strong>
            <p>필터를 바꾸면 다른 챌린지를 확인할 수 있습니다.</p>
          </div>
        ) : (
          <div className="glass-list">
            {pagedChallenges.map((challenge) => (
              <article className="glass-list-item glass-list-item--challenge" key={challenge.id}>
                <div className="glass-list-item__visual">
                  <ChallengeVisual
                    title={challenge.title}
                    thumbnailUrl={challenge.thumbnailUrl}
                    fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
                    className="glass-list-item__image"
                    placeholderClassName="glass-list-item__image glass-list-item__image--placeholder"
                  />
                </div>

                <div className="glass-list-item__content">
                  <div className="glass-list-item__header">
                    <div>
                      <span className="glass-list-item__eyebrow">CH-{String(challenge.id).padStart(2, '0')}</span>
                      <strong>{challenge.title}</strong>
                    </div>
                    <span className={`glass-badge${challenge.referenceMotionProfileReady ? ' is-accent' : ''}`}>
                      {challenge.referenceMotionProfileReady ? 'Ready' : 'Pending'}
                    </span>
                  </div>

                  <p className="glass-list-item__description">{challenge.description}</p>

                  <div className="glass-inline-meta">
                    <span>{challenge.category}</span>
                    <span>{challenge.difficulty}</span>
                    <span>{challenge.durationSec}초</span>
                    <span>
                      최근 점수 {challenge.latestRetrySummary ? `${challenge.latestRetrySummary.latestScore}점` : '없음'}
                    </span>
                  </div>
                </div>

                <div className="glass-list-item__actions">
                  <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
                    상세
                  </Link>
                  <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
                    시작
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}

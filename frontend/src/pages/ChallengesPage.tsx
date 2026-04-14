import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { getChallenges } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

type ChallengeFilter = 'ALL' | 'READY' | 'SCORED';

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('ALL');
  const [activeIndex, setActiveIndex] = useState(0);

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

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (activeFilter === 'READY') {
        return challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;
      }
      if (activeFilter === 'SCORED') {
        return !!challenge.latestRetrySummary;
      }
      return true;
    });
  }, [activeFilter, challenges]);

  useEffect(() => {
    if (activeIndex >= filteredChallenges.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredChallenges.length]);

  const activeChallenge = filteredChallenges[activeIndex] ?? null;
  const sideChallenges = filteredChallenges.filter((_, index) => index !== activeIndex).slice(0, 3);

  return (
    <div className="page page--stage">
      <section className="selector-hero">
        <div className="selector-hero__header">
          <div>
            <span className="selector-hero__eyebrow">Track Select</span>
            <h2>지금 들어갈 스테이지를 고르세요</h2>
            <p>레퍼런스 준비 상태와 최근 점수 흐름을 먼저 보고, 바로 상세나 시작 화면으로 넘어갈 수 있게 정리했습니다.</p>
          </div>
          <div className="selector-filters" role="tablist" aria-label="챌린지 필터">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={`selector-filter ${activeFilter === filter.value ? 'selector-filter--active' : ''}`}
                type="button"
                onClick={() => {
                  setActiveFilter(filter.value);
                  setActiveIndex(0);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="selector-empty">챌린지 라이브러리를 불러오는 중입니다.</div> : null}
        {error ? <div className="selector-empty selector-empty--error">{error}</div> : null}
        {!loading && !error && filteredChallenges.length === 0 ? (
          <div className="selector-empty">현재 필터에 맞는 챌린지가 없습니다.</div>
        ) : null}

        {!loading && !error && activeChallenge ? (
          <div className="selector-stage">
            <aside className="selector-side">
              {sideChallenges.map((challenge, index) => (
                <button
                  key={challenge.id}
                  className="selector-mini-card"
                  type="button"
                  onClick={() => {
                    const nextIndex = filteredChallenges.findIndex((item) => item.id === challenge.id);
                    setActiveIndex(nextIndex === -1 ? 0 : nextIndex);
                  }}
                >
                  <span className="selector-mini-card__rank">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{challenge.title}</strong>
                  <p>{challenge.referenceMotionProfileReady ? 'Ready to start' : 'Reference pending'}</p>
                </button>
              ))}
            </aside>

            <article className="selector-main-card">
              <div className="selector-main-card__media">
                <ChallengeVisual
                  title={activeChallenge.title}
                  thumbnailUrl={activeChallenge.thumbnailUrl}
                  fallbackThumbnailVideoUrl={activeChallenge.fallbackThumbnailVideoUrl}
                  className="selector-main-card__image"
                  placeholderClassName="selector-main-card__image selector-main-card__image--placeholder"
                />
              </div>
              <div className="selector-main-card__body">
                <div className="selector-main-card__topline">
                  <span>CH-{String(activeChallenge.id).padStart(2, '0')}</span>
                  <span>{activeChallenge.referenceMotionProfileReady ? 'READY' : 'WAIT'}</span>
                </div>
                <h3>{activeChallenge.title}</h3>
                <p>{activeChallenge.description}</p>

                <div className="selector-main-card__stats">
                  <div>
                    <span>Category</span>
                    <strong>{activeChallenge.category}</strong>
                  </div>
                  <div>
                    <span>Difficulty</span>
                    <strong>{activeChallenge.difficulty}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>{activeChallenge.durationSec}초</strong>
                  </div>
                  <div>
                    <span>Latest Score</span>
                    <strong>{activeChallenge.latestRetrySummary ? `${activeChallenge.latestRetrySummary.latestScore}점` : 'No score yet'}</strong>
                  </div>
                </div>

                <div className="selector-main-card__actions">
                  <button
                    className="button-link button-link--secondary"
                    type="button"
                    onClick={() => setActiveIndex((current) => (current === 0 ? filteredChallenges.length - 1 : current - 1))}
                  >
                    이전
                  </button>
                  <button
                    className="button-link button-link--secondary"
                    type="button"
                    onClick={() => setActiveIndex((current) => (current + 1) % filteredChallenges.length)}
                  >
                    다음
                  </button>
                  <Link className="button-link button-link--secondary" to={`/challenges/${activeChallenge.id}`}>
                    상세 보기
                  </Link>
                  <Link className="button-link" to={`/challenges/${activeChallenge.id}/start`}>
                    바로 시작
                  </Link>
                </div>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
}

const FILTERS: { value: ChallengeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'READY', label: 'Ready' },
  { value: 'SCORED', label: 'Scored' },
];

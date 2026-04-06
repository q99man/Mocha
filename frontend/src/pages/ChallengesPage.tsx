import { useEffect, useState } from 'react';
import { ChallengeCard } from '../features/challenges/ChallengeCard';
import { getChallenges } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const readyCount = challenges.filter((challenge) => challenge.referenceMotionProfileReady).length;

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">TRACK SELECT / CHALLENGE LIBRARY</span>
          <h2>지금 도전할 모션을 선택하고 준비 상태를 빠르게 판독하세요</h2>
          <p>DJMAX식 선택 화면 감성을 참고해, 챌린지 메타 정보와 준비 가능 여부를 한 번에 읽을 수 있는 구조로 정리합니다.</p>
        </div>
        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>TOTAL</span>
              <strong>{String(challenges.length).padStart(2, '0')}</strong>
              <p>현재 불러온 챌린지</p>
            </div>
            <div className="signal-grid__item">
              <span>READY</span>
              <strong>{String(readyCount).padStart(2, '0')}</strong>
              <p>업로드 기반 흐름 가능</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">LOADING</span>
            <div>
              <h2>챌린지 목록을 불러오는 중입니다</h2>
              <p>선택 가능한 모션 라인업을 정리하고 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="panel panel--error panel--section">
          <div className="section-heading">
            <span className="section-heading__code">ERROR</span>
            <div>
              <h2>챌린지 목록을 불러오지 못했습니다</h2>
              <p>{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && challenges.length === 0 ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">EMPTY</span>
            <div>
              <h2>등록된 챌린지가 없습니다</h2>
              <p>샘플 챌린지 데이터가 아직 준비되지 않았습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && challenges.length > 0 ? (
        <section className="grid grid--cards">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

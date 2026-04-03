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

  return (
    <div className="page">
      <section className="panel">
        <h2>챌린지 목록</h2>
        <p>원하는 챌린지를 선택해 설명을 확인하고, 다음 단계의 카메라 도전 흐름을 준비해 보세요.</p>
      </section>

      {loading ? (
        <section className="panel">
          <p>챌린지 목록을 불러오는 중입니다...</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel panel--error">
          <h2>챌린지 목록을 불러오지 못했습니다</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && !error && challenges.length === 0 ? (
        <section className="panel">
          <h2>등록된 챌린지가 없습니다</h2>
          <p>샘플 챌린지 데이터가 아직 준비되지 않았습니다.</p>
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

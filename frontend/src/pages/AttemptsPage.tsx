import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AttemptHistoryList } from '../features/attempts/AttemptHistoryList';
import { getAttempts } from '../shared/api/attemptApi';
import type { AttemptSummary } from '../shared/types/attempt';

export function AttemptsPage() {
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttempts() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttempts();
        if (active) {
          setAttempts(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '도전 기록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="panel">
        <h2>도전 기록</h2>
        <p>저장된 준비 기록과 최근 도전 결과를 간단히 확인할 수 있습니다.</p>
        <div className="inline-actions">
          <Link className="button-link button-link--secondary" to="/challenges">
            다른 챌린지 보러 가기
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <p>도전 기록을 불러오는 중입니다...</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel panel--error">
          <h2>도전 기록을 불러오지 못했습니다</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && !error && attempts.length === 0 ? (
        <section className="panel">
          <h2>아직 저장된 기록이 없습니다</h2>
          <p>챌린지를 시작하고 준비 상태를 저장하면 이곳에서 바로 확인할 수 있습니다.</p>
        </section>
      ) : null}

      {!loading && !error && attempts.length > 0 ? <AttemptHistoryList attempts={attempts} /> : null}
    </div>
  );
}
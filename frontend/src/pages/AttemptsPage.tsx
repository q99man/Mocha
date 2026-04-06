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

  const completedCount = attempts.filter((attempt) => attempt.status === '완료됨').length;
  const preparedCount = attempts.filter((attempt) => attempt.status === '준비됨').length;
  const autoscoredCount = attempts.filter((attempt) => attempt.resultSource === 'VIDEO_UPLOAD_AUTOSCORED').length;
  const sampleCount = attempts.filter((attempt) => attempt.resultSource === 'SAMPLE_SCORING_PREVIEW').length;

  return (
    <div className="page">
      <section className="hero hero--catalog">
        <div className="hero__content">
          <span className="hero__eyebrow">ARCHIVE / ATTEMPT LOG</span>
          <h2>준비 기록과 완료 결과를 한 화면에서 비교하는 아카이브 콘솔</h2>
          <p>
            Mocha의 현재 MVP 흐름은 준비 저장과 완료 결과가 같은 결과 구조를 공유합니다. 이 화면에서는 그 차이를 기록 단위로 빠르게 확인할 수 있습니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/challenges">
              챌린지로 이동
            </Link>
          </div>
        </div>

        <div className="hero__aside">
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift">
              <span>TOTAL</span>
              <strong>{String(attempts.length).padStart(2, '0')}</strong>
              <p>전체 저장 기록</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>CLEAR</span>
              <strong>{String(completedCount).padStart(2, '0')}</strong>
              <p>완료 결과</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>READY</span>
              <strong>{String(preparedCount).padStart(2, '0')}</strong>
              <p>준비 저장</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>LIVE</span>
              <strong>{String(autoscoredCount).padStart(2, '0')}</strong>
              <p>실제 자동 채점</p>
            </div>
          </div>
        </div>
      </section>

      {!loading && !error && attempts.length > 0 ? (
        <section className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>기록 분포 요약</h2>
              <p>이력 안에서 어떤 종류의 결과가 더 많은지 먼저 읽고, 아래 카드에서 개별 세션을 비교할 수 있습니다.</p>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-card stat-card--accent panel-lift panel-lift--accent">
              <strong>실제 업로드 자동 채점</strong>
              <p>{autoscoredCount}건</p>
            </div>
            <div className="stat-card panel-lift">
              <strong>샘플 preview 결과</strong>
              <p>{sampleCount}건</p>
            </div>
            <div className="stat-card panel-lift">
              <strong>준비 상태 저장</strong>
              <p>{preparedCount}건</p>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">LOADING</span>
            <div>
              <h2>도전 기록을 불러오는 중입니다</h2>
              <p>저장된 세션 로그와 결과 이력을 아카이브 패널로 정리하고 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="panel panel--error panel--section">
          <div className="section-heading">
            <span className="section-heading__code">ERROR</span>
            <div>
              <h2>도전 기록을 불러오지 못했습니다</h2>
              <p>{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && attempts.length === 0 ? (
        <section className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">EMPTY</span>
            <div>
              <h2>아직 저장된 기록이 없습니다</h2>
              <p>챌린지를 시작하고 준비 상태를 저장하거나 업로드 흐름을 실행하면 여기에서 바로 비교할 수 있습니다.</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && attempts.length > 0 ? <AttemptHistoryList attempts={attempts} /> : null}
    </div>
  );
}

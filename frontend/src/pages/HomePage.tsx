import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChallenges } from '../shared/api/challengeApi';
import { toAttemptBreakdownLabel } from '../shared/presentation/attemptBreakdown';
import type { Challenge } from '../shared/types/challenge';

type RetrySpotlight = { challenge: Challenge; delta: number | null };

export function HomePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadHomeSignals() {
      setLoading(true);
      try {
        const challengeResponse = await getChallenges().catch(() => []);
        if (active) {
          setChallenges(challengeResponse);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadHomeSignals();
    return () => { active = false; };
  }, []);

  const retrySpotlights = useMemo(() => {
    return challenges
      .filter((challenge) => challenge.latestRetrySummary)
      .map((challenge) => ({
        challenge,
        delta: challenge.latestRetrySummary?.scoreDeltaFromPrevious ?? null,
      }))
      .sort(
        (left, right) =>
          Date.parse(right.challenge.latestRetrySummary?.latestAttemptedAt ?? '') -
          Date.parse(left.challenge.latestRetrySummary?.latestAttemptedAt ?? ''),
      );
  }, [challenges]);

  const recentSpotlight = retrySpotlights[0] ?? null;
  const topImprovement = useMemo(
    () =>
      retrySpotlights
        .filter((item) => item.delta != null && item.delta > 0)
        .sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0] ?? null,
    [retrySpotlights],
  );
  const readyCount = challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady).length;
  const scoredCount = retrySpotlights.length;

  return (
    <div className="page">
      <section className="hero hero--stage">
        <div className="hero__content">
          <span className="hero__eyebrow">시작 화면 / 웹 MVP</span>
          <h2>하나의 모션 콘솔에서 챌린지를 고르고, 세팅을 확인하고, 재도전 결과까지 이어서 살펴보세요</h2>
          <p>Mocha는 모션 챌린지를 둘러보고 실제 시도를 업로드한 뒤 재도전 결과를 한 흐름에서 비교할 수 있는 가벼운 웹 콘솔입니다.</p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">챌린지 목록 열기</Link>
            <Link className="button-link button-link--secondary" to="/attempts">아카이브 열기</Link>
          </div>
        </div>
        <div className="hero__aside hero__aside--stage">
          <div className="signal-panel panel-lift panel-lift--accent">
            <span className="signal-panel__label">시스템 상태</span>
            <strong>{loading ? '실시간 상태 동기화 중' : '챌린지 흐름 준비 완료'}</strong>
            <p>홈, 챌린지 흐름, 결과, 아카이브가 이제 하나의 재도전 흐름으로 연결됩니다.</p>
          </div>
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift"><span>챌린지</span><strong>{String(challenges.length).padStart(2, '0')}</strong><p>불러온 챌린지 수</p></div>
            <div className="signal-grid__item panel-lift"><span>준비 완료</span><strong>{String(readyCount).padStart(2, '0')}</strong><p>실업로드 채점이 가능한 챌린지</p></div>
            <div className="signal-grid__item panel-lift"><span>채점 기록</span><strong>{String(scoredCount).padStart(2, '0')}</strong><p>채점 이력이 있는 챌린지</p></div>
            <div className="signal-grid__item panel-lift"><span>연결 상태</span><strong>{loading ? '--' : '동기화'}</strong><p>챌린지 요약에 재도전 맥락이 반영됩니다</p></div>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift home-spotlight">
        <div className="section-heading">
          <span className="section-heading__code">01</span>
          <div>
            <h2>재도전 스포트라이트</h2>
            <p>다른 페이지로 이동하지 않아도 최근 채점 결과와 가장 큰 향상 폭을 바로 볼 수 있습니다.</p>
          </div>
        </div>
        <div className="dashboard-grid home-spotlight__grid">
          <article className="panel panel--section home-spotlight__card">
            <span className="home-spotlight__label">가장 최근 채점 결과</span>
            {recentSpotlight && recentSpotlight.challenge.latestRetrySummary ? (
              <>
                <strong>{recentSpotlight.challenge.title}</strong>
                <p>{recentSpotlight.challenge.latestRetrySummary.latestScore}점 / {formatDelta(recentSpotlight.delta)}</p>
                <p>
                  {recentSpotlight.challenge.latestRetrySummary.retryFocus ??
                    (recentSpotlight.challenge.latestRetrySummary.weakestArea
                      ? `다음 재도전 전에는 ${toAttemptBreakdownLabel(recentSpotlight.challenge.latestRetrySummary.weakestArea)}부터 확인해 보세요.`
                      : '최신 결과를 열어 세부 분석을 확인한 뒤 다시 촬영해 보세요.')}
                </p>
                <div className="inline-actions">
                  <Link className="button-link button-link--secondary" to={`/attempts/${recentSpotlight.challenge.latestRetrySummary.latestAttemptId}/result`}>
                    최신 결과 보기
                  </Link>
                  <Link className="button-link button-link--secondary" to={`/challenges/${recentSpotlight.challenge.id}/start`}>
                    지금 다시 도전
                  </Link>
                </div>
              </>
            ) : (
              <>
                <strong>아직 채점 결과가 없습니다</strong>
                <p>첫 실제 비교 결과가 저장되면 여기에 자동 채점 업로드가 표시됩니다.</p>
              </>
            )}
          </article>

          <article className="panel panel--section home-spotlight__card">
            <span className="home-spotlight__label">가장 큰 향상</span>
            {topImprovement && topImprovement.challenge.latestRetrySummary ? (
              <>
                <strong>{topImprovement.challenge.title}</strong>
                <p>{formatDelta(topImprovement.delta)} / 최신 점수 {topImprovement.challenge.latestRetrySummary.latestScore}점</p>
                <p>
                  {topImprovement.challenge.latestRetrySummary.keepStableFocus ??
                    (topImprovement.challenge.latestRetrySummary.strongestArea
                      ? `직전 재도전에서는 ${toAttemptBreakdownLabel(topImprovement.challenge.latestRetrySummary.strongestArea)}이 가장 안정적으로 유지됐습니다.`
                      : '결과 페이지에서 전체 비교와 강점 영역을 확인해 보세요.')}
                </p>
                <div className="inline-actions">
                  <Link className="button-link button-link--secondary" to={`/challenges/${topImprovement.challenge.id}`}>
                    챌린지 상세 보기
                  </Link>
                  <Link className="button-link button-link--secondary" to="/attempts">
                    아카이브 열기
                  </Link>
                </div>
              </>
            ) : (
              <>
                <strong>아직 향상 추세가 없습니다</strong>
                <p>같은 챌린지에 채점 결과가 두 번 이상 쌓이면 가장 큰 점수 상승이 여기에 표시됩니다.</p>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">02</span>
          <div>
            <h2>현재 핵심 흐름</h2>
            <p>지금 MVP는 일회성 데모보다 재도전 루프를 중심으로 동작합니다.</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card stat-card--accent panel-lift panel-lift--accent"><strong>챌린지 탐색</strong><p>다음 이동 전에 챌린지 메타데이터, 준비 상태, 재도전 맥락을 먼저 확인합니다.</p></div>
          <div className="stat-card panel-lift"><strong>실업로드 흐름</strong><p>별도 프로토타입 경로 없이 시작 화면에서 실제 채점 업로드까지 바로 이어집니다.</p></div>
          <div className="stat-card panel-lift"><strong>재도전 비교</strong><p>결과 페이지와 아카이브 카드에서 점수 변화, 세부 분석, 코칭 힌트를 함께 봅니다.</p></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section panel-lift">
          <div className="section-heading"><span className="section-heading__code">03</span><div><h2>추천 흐름</h2><p>지금 가장 유용한 흐름은 최근 재도전 결과를 확인한 뒤 같은 챌린지로 다시 들어가는 방식입니다.</p></div></div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 홈 스포트라이트에서 최신 채점 결과나 가장 큰 향상을 확인합니다</div>
            <div className="detail-flow__item">2. 같은 챌린지의 상세 또는 시작 화면으로 이동합니다</div>
            <div className="detail-flow__item">3. 같은 세팅으로 새 시도를 업로드합니다</div>
            <div className="detail-flow__item">4. 결과 페이지에서 점수 변화, 세부 분석, 코칭을 비교합니다</div>
          </div>
        </article>

        <article className="panel panel--section panel-lift">
          <div className="section-heading"><span className="section-heading__code">04</span><div><h2>다음 완성 목표</h2><p>다음 단계는 재도전 신호를 더 강한 코칭과 가이드로 연결하는 것입니다.</p></div></div>
          <ul className="detail-list">
            <li><strong>재도전 연속성</strong>홈, 목록, 상세, 시작, 결과, 아카이브 전반에 같은 챌린지 맥락이 이어지도록 유지합니다.</li>
            <li><strong>코칭 품질</strong>약한 영역과 점수 변화 신호를 다음 재도전 촬영 가이드로 더 선명하게 바꿉니다.</li>
            <li><strong>운영 가시성</strong>모델, 레퍼런스, 채점 결과 상태를 숨은 가정 없이 UI에서 읽을 수 있게 만듭니다.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

function formatDelta(delta: number | null) {
  return delta == null ? '기준점' : delta === 0 ? '변화 없음' : `${delta > 0 ? '+' : ''}${delta}점`;
}

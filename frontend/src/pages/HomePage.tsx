import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { getChallenges } from '../shared/api/challengeApi';
import type { Challenge } from '../shared/types/challenge';

export function HomePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadChallenges() {
      setLoading(true);
      try {
        const response = await getChallenges().catch(() => []);
        if (active) {
          setChallenges(response);
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

  const readyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady),
    [challenges],
  );
  const featuredChallenge = readyChallenges[0] ?? challenges[0] ?? null;
  const latestScoredChallenge = useMemo(
    () =>
      [...challenges]
        .filter((challenge) => challenge.latestRetrySummary)
        .sort(
          (left, right) =>
            Date.parse(right.latestRetrySummary?.latestAttemptedAt ?? '') -
            Date.parse(left.latestRetrySummary?.latestAttemptedAt ?? ''),
        )[0] ?? null,
    [challenges],
  );

  return (
    <div className="page page--stage">
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <span className="landing-hero__eyebrow">Stage Entry</span>
          <h2>모션 챌린지</h2>
          <p>
            챌린지를 고르고, 준비 상태를 확인하고, 촬영 흐름으로 곧바로 도전해 보세요.
          </p>
          <div className="landing-hero__actions">
            <Link className="button-link" to="/challenges">
              챌린지 선택
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              최근 기록 보기
            </Link>
          </div>
        </div>

        <div className="landing-hero__feature">
          {featuredChallenge ? (
            <article className="feature-poster">
              <div className="feature-poster__media">
                <ChallengeVisual
                  title={featuredChallenge.title}
                  thumbnailUrl={featuredChallenge.thumbnailUrl}
                  fallbackThumbnailVideoUrl={featuredChallenge.fallbackThumbnailVideoUrl}
                  className="feature-poster__image"
                  placeholderClassName="feature-poster__image feature-poster__image--placeholder"
                />
              </div>
              <div className="feature-poster__body">
                <span className="feature-poster__label">Featured Track</span>
                <strong>{featuredChallenge.title}</strong>
                <p>{featuredChallenge.description}</p>
                <div className="feature-poster__meta">
                  <span>{featuredChallenge.category}</span>
                  <span>{featuredChallenge.difficulty}</span>
                  <span>{featuredChallenge.durationSec}초</span>
                </div>
                <Link className="button-link" to={`/challenges/${featuredChallenge.id}`}>
                  트랙 보기
                </Link>
              </div>
            </article>
          ) : (
            <article className="feature-poster feature-poster--empty">
              <span className="feature-poster__label">Featured Track</span>
              <strong>아직 준비된 챌린지가 없습니다</strong>
              <p>운영 화면에서 레퍼런스 영상을 등록하면 이 자리부터 스테이지 흐름이 시작됩니다.</p>
            </article>
          )}
        </div>
      </section>

      <section className="stage-strip">
        <article className="stage-stat">
          <span className="stage-stat__label">Library</span>
          <strong>{String(challenges.length).padStart(2, '0')}</strong>
          <p>현재 로드된 챌린지 수</p>
        </article>
        <article className="stage-stat">
          <span className="stage-stat__label">Ready</span>
          <strong>{String(readyChallenges.length).padStart(2, '0')}</strong>
          <p>바로 촬영 가능한 챌린지</p>
        </article>
        <article className="stage-stat">
          <span className="stage-stat__label">Scored</span>
          <strong>{String(challenges.filter((challenge) => challenge.latestRetrySummary).length).padStart(2, '0')}</strong>
          <p>점수 이력이 있는 챌린지</p>
        </article>
        <article className="stage-stat">
          <span className="stage-stat__label">Status</span>
          <strong>{loading ? 'SYNC' : 'READY'}</strong>
          <p>{loading ? '챌린지 메타데이터를 불러오는 중입니다.' : '스테이지 진입 준비가 끝났습니다.'}</p>
        </article>
      </section>

      <section className="stage-grid">
        <article className="stage-panel">
          <div className="stage-panel__heading">
            <span>Quick Flow</span>
            <h3>한 번에 이어지는 기본 루프</h3>
          </div>
          <div className="flow-list">
            <div className="flow-list__item">
              <strong>01</strong>
              <p>챌린지 라이브러리에서 지금 들어갈 트랙을 고릅니다.</p>
            </div>
            <div className="flow-list__item">
              <strong>02</strong>
              <p>레퍼런스 준비 상태와 최근 점수 흐름을 보고 시작 여부를 판단합니다.</p>
            </div>
            <div className="flow-list__item">
              <strong>03</strong>
              <p>촬영 또는 업로드로 진입하고, 결과 화면에서 바로 다음 리트라이 방향을 확인합니다.</p>
            </div>
          </div>
        </article>

        <article className="stage-panel">
          <div className="stage-panel__heading">
            <span>Latest Signal</span>
            <h3>최근 점수 흐름</h3>
          </div>
          {latestScoredChallenge?.latestRetrySummary ? (
            <div className="signal-card">
              <strong>{latestScoredChallenge.title}</strong>
              <p>
                최근 점수 {latestScoredChallenge.latestRetrySummary.latestScore}점
                {latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious != null
                  ? ` / 변화 ${formatDelta(latestScoredChallenge.latestRetrySummary.scoreDeltaFromPrevious)}`
                  : ''}
              </p>
              <p>{latestScoredChallenge.latestRetrySummary.retryFocus ?? latestScoredChallenge.latestRetrySummary.coachingTeaser ?? '결과 화면에서 자세한 비교와 코칭을 확인할 수 있습니다.'}</p>
              <div className="landing-hero__actions">
                <Link className="button-link button-link--secondary" to={`/attempts/${latestScoredChallenge.latestRetrySummary.latestAttemptId}/result`}>
                  최근 결과
                </Link>
                <Link className="button-link button-link--secondary" to={`/challenges/${latestScoredChallenge.id}/start`}>
                  다시 도전
                </Link>
              </div>
            </div>
          ) : (
            <div className="signal-card signal-card--empty">
              <strong>아직 점수 신호가 없습니다</strong>
              <p>첫 시도 결과가 생기면 최근 점수 흐름과 리트라이 힌트를 여기서 바로 보여줍니다.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function formatDelta(delta: number) {
  return `${delta > 0 ? '+' : ''}${delta}점`;
}

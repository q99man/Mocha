import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ReviewList } from '../features/reviews/ReviewList';
import { Pagination } from '../shared/components/Pagination';
import { getAttempts } from '../shared/api/attemptApi';
import { getMyReviews } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import type { AttemptSummary } from '../shared/types/attempt';
import type { Review } from '../shared/types/review';

const ATTEMPTS_PER_PAGE = 5;
const REVIEWS_PER_PAGE = 4;

export function MyPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptPage, setAttemptPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadMyPageData() {
      setLoading(true);
      setError(null);

      try {
        const [attemptResponse, reviewResponse] = await Promise.all([getAttempts(), getMyReviews()]);

        if (active) {
          setAttempts(attemptResponse);
          setReviews(reviewResponse);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '마이페이지 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMyPageData();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const bestAttempt = attempts.reduce<AttemptSummary | null>(
      (currentBest, attempt) => (!currentBest || attempt.score > currentBest.score ? attempt : currentBest),
      null,
    );

    return {
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter((attempt) => attempt.status === 'Completed').length,
      reviewCount: reviews.length,
      bestAttempt,
    };
  }, [attempts, reviews]);

  const attemptTotalPages = Math.max(1, Math.ceil(attempts.length / ATTEMPTS_PER_PAGE));
  const reviewTotalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));

  const pagedAttempts = useMemo(() => {
    const startIndex = (attemptPage - 1) * ATTEMPTS_PER_PAGE;
    return attempts.slice(startIndex, startIndex + ATTEMPTS_PER_PAGE);
  }, [attemptPage, attempts]);

  const pagedReviews = useMemo(() => {
    const startIndex = (reviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [reviewPage, reviews]);

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>마이페이지를 준비하는 중입니다.</strong>
          <p>내 기록과 후기를 모으고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>마이페이지를 불러오지 못했습니다.</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">My Page</span>
          <h2>{user?.displayName ?? '사용자'}님의 핵심 기록만 모았습니다</h2>
          <p>요약 수치, 최근 시도, 내가 쓴 후기만 남겨서 다음 행동으로 바로 이어질 수 있게 구성했습니다.</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>시도</span>
            <strong>{String(summary.totalAttempts).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>완료</span>
            <strong>{String(summary.completedAttempts).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>후기</span>
            <strong>{String(summary.reviewCount).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div className="glass-inline-meta">
            <span>{user?.email}</span>
            <span>최고 점수 {summary.bestAttempt ? `${summary.bestAttempt.score}점` : '없음'}</span>
            <span>{summary.bestAttempt?.challengeTitle ?? '아직 완료 기록 없음'}</span>
          </div>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/challenges">
              챌린지 보기
            </Link>
            <Link className="button-link" to="/attempts">
              전체 기록
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">최근 시도</h3>
            <p className="glass-toolbar__note">시도 기록은 시간순으로 정리했고, 자세한 분석은 결과 페이지로 이동합니다.</p>
          </div>
        </div>

        {pagedAttempts.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>아직 시도 기록이 없습니다.</strong>
            <p>첫 챌린지를 시작하면 여기에 최근 기록이 쌓입니다.</p>
          </div>
        ) : (
          <div className="glass-list">
            {pagedAttempts.map((attempt) => (
              <article className="glass-list-item" key={attempt.id}>
                <div className="glass-list-item__content">
                  <div className="glass-list-item__header">
                    <div>
                      <span className="glass-list-item__eyebrow">{formatDate(attempt.attemptedAt)}</span>
                      <strong>{attempt.challengeTitle}</strong>
                    </div>
                    <span className={`glass-badge${attempt.processingComplete ? ' is-accent' : ''}`}>
                      {attempt.processingComplete ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <div className="glass-inline-meta">
                    <span>{attempt.scoreAvailable ? `${attempt.score}점` : '점수 대기 중'}</span>
                    <span>{attempt.resultSource}</span>
                  </div>
                  <p className="glass-list-item__description">{attempt.resultHeadline}</p>
                </div>
                <div className="glass-list-item__actions">
                  <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                    결과 보기
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <Pagination currentPage={attemptPage} totalPages={attemptTotalPages} onPageChange={setAttemptPage} />
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">내 후기</h3>
            <p className="glass-toolbar__note">상세 페이지로 이동하면 수정과 삭제까지 바로 이어서 할 수 있습니다.</p>
          </div>
        </div>

        <ReviewList
          reviews={pagedReviews}
          emptyTitle="아직 작성한 후기가 없습니다."
          emptyDescription="챌린지를 시도한 뒤 상세 화면에서 첫 후기를 남겨보세요."
          showChallengeLink
        />

        <Pagination currentPage={reviewPage} totalPages={reviewTotalPages} onPageChange={setReviewPage} />
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

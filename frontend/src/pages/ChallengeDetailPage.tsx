import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { ReviewComposer } from '../features/reviews/ReviewComposer';
import { ReviewList } from '../features/reviews/ReviewList';
import { Pagination } from '../shared/components/Pagination';
import { getChallengeById } from '../shared/api/challengeApi';
import {
  createChallengeReview,
  getChallengeReviews,
  removeReview,
  updateReview,
} from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import type { Challenge } from '../shared/types/challenge';
import type { Review, ReviewInput } from '../shared/types/review';

const INITIAL_REVIEW_FORM: ReviewInput = {
  rating: 5,
  content: '',
};
const REVIEWS_PER_PAGE = 4;

export function ChallengeDetailPage() {
  const { id = '' } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewInput>(INITIAL_REVIEW_FORM);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [currentReviewPage, setCurrentReviewPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [challengeResponse, reviewResponse] = await Promise.all([
          getChallengeById(id),
          getChallengeReviews(id),
        ]);

        if (active) {
          setChallenge(challengeResponse);
          setReviews(reviewResponse);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '챌린지 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [id, user?.id]);

  const myReview = useMemo(() => reviews.find((review) => review.mine) ?? null, [reviews]);

  const reviewSummary = useMemo(() => {
    if (reviews.length === 0) {
      return { average: '--', total: 0 };
    }

    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      average: (total / reviews.length).toFixed(1),
      total: reviews.length,
    };
  }, [reviews]);

  const reviewTotalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));

  const pagedReviews = useMemo(() => {
    const startIndex = (currentReviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [currentReviewPage, reviews]);

  useEffect(() => {
    if (myReview) {
      setReviewForm({ rating: myReview.rating, content: myReview.content });
    } else {
      setReviewForm(INITIAL_REVIEW_FORM);
    }
  }, [myReview]);

  useEffect(() => {
    if (currentReviewPage > reviewTotalPages) {
      setCurrentReviewPage(reviewTotalPages);
    }
  }, [currentReviewPage, reviewTotalPages]);

  async function refreshReviews() {
    const nextReviews = await getChallengeReviews(id);
    setReviews(nextReviews);
  }

  async function handleReviewSubmit() {
    setReviewBusy(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      const payload = {
        rating: reviewForm.rating,
        content: reviewForm.content.trim(),
      };

      if (myReview) {
        await updateReview(myReview.id, payload);
        setReviewSuccess('후기를 수정했습니다.');
      } else {
        await createChallengeReview(id, payload);
        setReviewSuccess('후기를 등록했습니다.');
      }

      await refreshReviews();
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : '후기를 저장하지 못했습니다.');
    } finally {
      setReviewBusy(false);
    }
  }

  async function handleReviewDelete() {
    if (!myReview) {
      return;
    }

    setReviewBusy(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      await removeReview(myReview.id);
      await refreshReviews();
      setReviewSuccess('후기를 삭제했습니다.');
    } catch (deleteError) {
      setReviewError(deleteError instanceof Error ? deleteError.message : '후기를 삭제하지 못했습니다.');
    } finally {
      setReviewBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 정보를 불러오는 중입니다.</strong>
          <p>도전 정보와 사용자 후기를 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 정보를 불러오지 못했습니다.</strong>
          <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
        </div>
      </section>
    );
  }

  const latestScore = challenge.latestRetrySummary ? `${challenge.latestRetrySummary.latestScore}점` : '기록 없음';

  return (
    <div className="glass-page">
      <section className="glass-hero-card">
        <div className="glass-hero-card__visual">
          <ChallengeVisual
            title={challenge.title}
            thumbnailUrl={challenge.thumbnailUrl}
            fallbackThumbnailVideoUrl={challenge.fallbackThumbnailVideoUrl}
            className="glass-hero-card__image"
            placeholderClassName="glass-hero-card__image glass-hero-card__image--placeholder"
          />
        </div>

        <div className="glass-hero-card__content">
          <span className="glass-intro__eyebrow">Challenge Detail</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>

          <div className="glass-inline-meta">
            <span>{challenge.category}</span>
            <span>{challenge.difficulty}</span>
            <span>{challenge.durationSec}초</span>
            <span>최근 점수 {latestScore}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              도전 시작
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              기록 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-summary-grid">
          <article className="glass-summary-card">
            <span>레퍼런스 분석</span>
            <strong>{formatAnalysisStatus(challenge.referenceAnalysisStatus)}</strong>
            <p>도전 가능 여부를 결정하는 기준입니다.</p>
          </article>
          <article className="glass-summary-card">
            <span>프로필 상태</span>
            <strong>{challenge.referenceMotionProfileReady ? 'Ready' : 'Pending'}</strong>
            <p>{challenge.referenceMotionProfileReady ? '즉시 시작할 수 있습니다.' : '분석 완료 후 시작 가능합니다.'}</p>
          </article>
          <article className="glass-summary-card">
            <span>후기 평점</span>
            <strong>{reviewSummary.average}</strong>
            <p>총 {reviewSummary.total}개의 후기</p>
          </article>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">사용자 후기</h3>
            <p className="glass-toolbar__note">리뷰는 상세에서 작성하고, 랜딩과 마이페이지에도 같은 데이터가 반영됩니다.</p>
          </div>
        </div>

        {isAuthenticated ? (
          <ReviewComposer
            value={reviewForm}
            busy={reviewBusy}
            submitLabel={myReview ? '후기 수정' : '후기 등록'}
            error={reviewError}
            success={reviewSuccess}
            hasExistingReview={Boolean(myReview)}
            onChange={setReviewForm}
            onSubmit={handleReviewSubmit}
            onDelete={myReview ? handleReviewDelete : undefined}
          />
        ) : (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>로그인 후 후기를 남길 수 있습니다.</strong>
            <p>챌린지를 시도한 사용자만 리뷰를 작성할 수 있습니다.</p>
            <div className="inline-actions">
              <Link className="button-link button-link--secondary" to="/auth">
                로그인
              </Link>
            </div>
          </div>
        )}

        <ReviewList
          reviews={pagedReviews}
          emptyTitle="아직 등록된 후기가 없습니다."
          emptyDescription="첫 후기를 남겨 이 챌린지의 실제 경험을 채워보세요."
        />

        <Pagination currentPage={currentReviewPage} totalPages={reviewTotalPages} onPageChange={setCurrentReviewPage} />
      </section>
    </div>
  );
}

function formatAnalysisStatus(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'ANALYZING') return 'Analyzing';
  if (status === 'FAILED') return 'Failed';
  return 'Pending';
}

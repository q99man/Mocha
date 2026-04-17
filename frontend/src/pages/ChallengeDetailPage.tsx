import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChallengeVisual } from '../features/challenges/ChallengeVisual';
import { ReviewComposer } from '../features/reviews/ReviewComposer';
import { ReviewList } from '../features/reviews/ReviewList';
import { getChallengeById } from '../shared/api/challengeApi';
import {
  createChallengeReview,
  getChallengeReviews,
  removeReview,
  updateReview,
} from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { Pagination } from '../shared/components/Pagination';
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
        const [challengeResponse, reviewResponse] = await Promise.all([getChallengeById(id), getChallengeReviews(id)]);
        if (active) {
          setChallenge(challengeResponse);
          setReviews(reviewResponse);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '챌린지 상세 화면을 불러오지 못했습니다.');
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
  const myBoardPostId = myReview?.boardPostId ?? null;

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

  const challengeReviewQuery = useMemo(() => {
    if (!challenge) {
      return '';
    }

    return new URLSearchParams({
      sourceType: 'REVIEW_SYNC',
      challengeId: String(challenge.id),
      challengeTitle: challenge.title,
    }).toString();
  }, [challenge]);

  const reviewTotalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));

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

  const pagedReviews = useMemo(() => {
    const startIndex = (currentReviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [currentReviewPage, reviews]);

  async function refreshReviews() {
    const nextReviews = await getChallengeReviews(id);
    setReviews(nextReviews);
    setCurrentReviewPage(1);
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
        setReviewSuccess('후기가 수정되었습니다.');
      } else {
        await createChallengeReview(id, payload);
        setReviewSuccess('후기가 등록되었습니다.');
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
      setReviewSuccess('후기가 삭제되었습니다.');
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
          <strong>챌린지 상세 정보를 불러오는 중입니다.</strong>
          <p>챌린지 정보와 후기 데이터를 함께 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지를 불러오지 못했습니다.</strong>
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
          <span className="glass-intro__eyebrow">챌린지 상세</span>
          <h2>{challenge.title}</h2>
          <p>{challenge.description}</p>

          <div className="glass-inline-meta">
            <span>{challenge.category}</span>
            <span>{challenge.difficulty}</span>
            <span>{formatDuration(challenge.durationSec)}</span>
            <span>최근 점수 {latestScore}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={`/challenges/${challenge.id}/start`}>
              챌린지 시작
            </Link>
            <Link className="button-link button-link--secondary" to={`/attempts?challengeId=${challenge.id}`}>
              내 기록 보기
            </Link>
            {challengeReviewQuery ? (
              <Link className="button-link button-link--secondary" to={`/board?${challengeReviewQuery}`}>
                이 챌린지 후기 모아보기
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-summary-grid">
          <article className="glass-summary-card">
            <span>분석 상태</span>
            <strong>{formatAnalysisStatus(challenge.referenceAnalysisStatus)}</strong>
            <p>현재 도전 가능한 상태인지 먼저 확인할 수 있도록 요약했습니다.</p>
          </article>

          <article className="glass-summary-card">
            <span>모션 프로필</span>
            <strong>{challenge.referenceMotionProfileReady ? '준비 완료' : '대기 중'}</strong>
            <p>
              {challenge.referenceMotionProfileReady
                ? '지금 바로 시작할 수 있습니다.'
                : '분석 완료 후 시작할 수 있습니다.'}
            </p>
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
            <p className="glass-toolbar__note">
              랜딩, 상세, 마이페이지에서 같은 후기 데이터를 공유하고 게시판 후기 흐름까지 자연스럽게 이어지도록 연결했습니다.
            </p>
          </div>
          <div className="inline-actions">
            {myBoardPostId ? (
              <Link className="button-link button-link--secondary" to={`/board/${myBoardPostId}`}>
                내 후기 게시판에서 보기
              </Link>
            ) : null}
            {challengeReviewQuery ? (
              <Link className="button-link" to={`/board?${challengeReviewQuery}`}>
                전체 후기 흐름 보기
              </Link>
            ) : null}
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
            <strong>로그인 후 후기를 작성할 수 있습니다.</strong>
            <p>회원만 챌린지 후기를 작성하고 수정할 수 있습니다.</p>
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
          emptyDescription="이 챌린지의 첫 후기를 남겨 보세요."
          showBoardLink
        />

        <Pagination currentPage={currentReviewPage} totalPages={reviewTotalPages} onPageChange={setCurrentReviewPage} />
      </section>
    </div>
  );
}

function formatAnalysisStatus(status: Challenge['referenceAnalysisStatus']) {
  if (status === 'COMPLETED') return '완료';
  if (status === 'ANALYZING') return '분석 중';
  if (status === 'FAILED') return '실패';
  return '대기';
}

function formatDuration(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}초`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import type { Review } from '../../shared/types/review';
import { ReviewStars } from '../reviews/ReviewStars';

type LandingUseCaseSectionProps = {
  reviews: Review[];
};

type ReviewRow = 'left' | 'right';

export function LandingUseCaseSection({ reviews }: LandingUseCaseSectionProps) {
  const distributedReviews = useMemo(() => distributeReviews(reviews), [reviews]);
  const firstRow = distributedReviews.filter((_, index) => index % 2 === 0);
  const secondRow = distributedReviews.filter((_, index) => index % 2 === 1);
  const secondRowSource = secondRow.length > 0 ? secondRow : firstRow;

  return (
    <section className="lp-section lp-section--light" id="use-case">
      <div className="lp-section__header lp-section__header--light">
        <span className="lp-kicker">Review</span>
      </div>

      {reviews.length > 0 ? (
        <div className="lp-review-marquee">
          <div className="lp-review-marquee__viewport">
            <div className="lp-review-marquee__track lp-review-marquee__track--left">
              <ReviewCardGroup reviews={firstRow} row="left" clone={false} />
              {firstRow.length > 1 ? <ReviewCardGroup reviews={firstRow} row="left" clone /> : null}
            </div>
          </div>

          <div className="lp-review-marquee__viewport">
            <div className="lp-review-marquee__track lp-review-marquee__track--right">
              <ReviewCardGroup reviews={secondRowSource} row="right" clone={false} />
              {secondRowSource.length > 1 ? <ReviewCardGroup reviews={secondRowSource} row="right" clone /> : null}
            </div>
          </div>
        </div>
      ) : (
        <article className="lp-review-empty lp-panel-glass">
          <span className="lp-kicker">Coming soon</span>
        </article>
      )}
    </section>
  );
}

function ReviewCardGroup({ reviews, row, clone }: { reviews: Review[]; row: ReviewRow; clone: boolean }) {
  return (
    <div className="lp-review-marquee__group" aria-hidden={clone}>
      {reviews.map((review, index) => (
        <ReviewCard
          key={`${review.id}-${row}-${clone ? 'clone' : 'base'}`}
          review={review}
          ariaHidden={clone}
          offset={getReviewOffset(review, index, row)}
        />
      ))}
    </div>
  );
}

type ReviewCardProps = {
  review: Review;
  ariaHidden: boolean;
  offset: number;
};

function ReviewCard({ review, ariaHidden, offset }: ReviewCardProps) {
  return (
    <Link
      className="lp-usecase-grid__card lp-review-card lp-panel-glass"
      to={`/challenges?challengeId=${review.challengeId}&panel=reviews`}
      aria-hidden={ariaHidden}
      aria-label={`${review.challengeTitle} 챌린지 후기 보러가기`}
      tabIndex={ariaHidden ? -1 : undefined}
      style={{ '--review-offset': `${offset}px` } as CSSProperties}
    >
      <div className="lp-review-card__top">
        <div className="lp-review-card__meta">
          <span className="lp-kicker">Challenge</span>
          <strong>{review.challengeTitle}</strong>
        </div>
        <ReviewStars value={review.rating} />
      </div>

      <p className="lp-review-card__content">{review.content}</p>

      <div className="lp-review-card__bottom">
        <div className="lp-review-card__author">
          <strong>{review.memberDisplayName}</strong>
          <span>{formatReviewDate(review.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function distributeReviews(reviews: Review[]) {
  const seed = Math.floor(Math.random() * 2147483647);
  return [...reviews].sort((left, right) => {
    const leftScore = hashReview(left.id, left.challengeId + seed);
    const rightScore = hashReview(right.id, right.challengeId + seed);
    return leftScore - rightScore;
  });
}

function getReviewOffset(review: Review, index: number, row: ReviewRow) {
  const offsets = row === 'left' ? [-6, 3, -2, 7, -4, 1, 5, -7, 2, -5, 0] : [4, -6, 2, -3, 7, -1, 5, -5, 0, 6, -2];
  return offsets[(hashReview(review.id, index * 3 + (row === 'left' ? 17 : 31)) + index) % offsets.length];
}

function hashReview(id: number, salt: number) {
  return Math.abs((id * 1103515245 + salt * 12345) % 2147483647);
}

function formatReviewDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}

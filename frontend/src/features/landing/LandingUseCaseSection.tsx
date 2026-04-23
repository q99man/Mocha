import { Link } from 'react-router-dom';

import type { Review } from '../../shared/types/review';
import { ReviewStars } from '../reviews/ReviewStars';

type LandingUseCaseSectionProps = {
  reviews: Review[];
};

export function LandingUseCaseSection({ reviews }: LandingUseCaseSectionProps) {
  const firstRow = reviews.filter((_, index) => index % 2 === 0);
  const secondRow = reviews.filter((_, index) => index % 2 === 1);
  const firstRowLoop = firstRow.length > 1 ? [...firstRow, ...firstRow] : firstRow;
  const secondRowSource = secondRow.length > 0 ? secondRow : firstRow;
  const secondRowLoop = secondRowSource.length > 1 ? [...secondRowSource, ...secondRowSource] : secondRowSource;

  return (
    <section className="lp-section lp-section--light" id="use-case">
      <div className="lp-section__header lp-section__header--light">
        <span className="lp-kicker">Review</span>
      </div>

      {reviews.length > 0 ? (
        <div className="lp-review-marquee">
          <div className="lp-review-marquee__viewport">
            <div className="lp-review-marquee__track lp-review-marquee__track--left">
              {firstRowLoop.map((review, index) => (
                <ReviewCard
                  key={`${review.id}-left-${index < firstRow.length ? 'base' : 'clone'}`}
                  review={review}
                  ariaHidden={firstRow.length > 1 && index >= firstRow.length}
                />
              ))}
            </div>
          </div>

          <div className="lp-review-marquee__viewport">
            <div className="lp-review-marquee__track lp-review-marquee__track--right">
              {secondRowLoop.map((review, index) => (
                <ReviewCard
                  key={`${review.id}-right-${index < secondRowSource.length ? 'base' : 'clone'}`}
                  review={review}
                  ariaHidden={secondRowSource.length > 1 && index >= secondRowSource.length}
                />
              ))}
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

type ReviewCardProps = {
  review: Review;
  ariaHidden: boolean;
};

function ReviewCard({ review, ariaHidden }: ReviewCardProps) {
  return (
    <Link
      className="lp-usecase-grid__card lp-review-card lp-panel-glass"
      to={`/challenges?challengeId=${review.challengeId}&panel=reviews`}
      aria-hidden={ariaHidden}
      aria-label={`${review.challengeTitle} 챌린지 후기 보러가기`}
      tabIndex={ariaHidden ? -1 : undefined}
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

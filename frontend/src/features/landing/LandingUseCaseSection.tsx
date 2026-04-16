import { Link } from 'react-router-dom';

import { ReviewStars } from '../reviews/ReviewStars';
import type { Review } from '../../shared/types/review';

type LandingUseCaseSectionProps = {
  reviews: Review[];
};

export function LandingUseCaseSection({ reviews }: LandingUseCaseSectionProps) {
  return (
    <section className="lp-section lp-section--light" id="use-case">
      <div className="lp-section__header lp-section__header--light">
        <span className="lp-kicker">Reviews</span>
      </div>

      {reviews.length > 0 ? (
        <div className="lp-usecase-grid">
          {reviews.map((review) => (
            <article className="lp-usecase-grid__card lp-review-card lp-panel-glass" key={review.id}>
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
                <Link className="lp-review-card__link" to={`/challenges/${review.challengeId}`}>
                  챌린지 보기
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="lp-review-empty lp-panel-glass">
          <span className="lp-kicker">Coming soon</span>
          <strong>등록된 사용자 후기가 여기에 표시됩니다.</strong>
          <p>실제 리뷰 데이터가 연결되면 이 영역에서 자연스럽게 노출되도록 준비된 상태입니다.</p>
        </article>
      )}
    </section>
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

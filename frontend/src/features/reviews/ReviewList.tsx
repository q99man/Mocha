import { Link } from 'react-router-dom';
import type { Review } from '../../shared/types/review';
import { ReviewStars } from './ReviewStars';

type ReviewListProps = {
  reviews: Review[];
  emptyTitle: string;
  emptyDescription: string;
  showChallengeLink?: boolean;
};

export function ReviewList({
  reviews,
  emptyTitle,
  emptyDescription,
  showChallengeLink = false,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="mypage-empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="review-list">
      {reviews.map((review) => (
        <article className="review-card panel-lift" key={review.id}>
          <div className="review-card__header">
            <div>
              <span>{showChallengeLink ? '챌린지' : '작성자'}</span>
              <strong>{showChallengeLink ? review.challengeTitle : review.memberDisplayName}</strong>
            </div>
            <ReviewStars value={review.rating} />
          </div>

          <p className="review-card__content">{review.content}</p>

          <div className="review-card__footer">
            <span>{formatReviewDate(review.updatedAt)}</span>
            {showChallengeLink ? (
              <Link className="button-link button-link--secondary" to={`/challenges/${review.challengeId}`}>
                챌린지 보기
              </Link>
            ) : (
              <span className="review-card__badge">{review.mine ? '내 후기' : '사용자 후기'}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function formatReviewDate(value: string) {
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

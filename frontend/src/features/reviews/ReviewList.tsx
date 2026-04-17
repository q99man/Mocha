import { Link } from 'react-router-dom';

import type { Review } from '../../shared/types/review';
import { ReviewStars } from './ReviewStars';

type ReviewListProps = {
  reviews: Review[];
  emptyTitle: string;
  emptyDescription: string;
  showChallengeLink?: boolean;
  showBoardLink?: boolean;
};

export function ReviewList({
  reviews,
  emptyTitle,
  emptyDescription,
  showChallengeLink = false,
  showBoardLink = false,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="glass-panel glass-panel--nested glass-panel--empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="glass-list">
      {reviews.map((review) => {
        const hasBoardLink = showBoardLink && review.boardPostId != null;

        return (
          <article className="glass-list-item" key={review.id}>
            <div className="glass-list-item__content">
              <div className="glass-list-item__header">
                <div>
                  <span className="glass-list-item__eyebrow">
                    {showChallengeLink ? '챌린지 후기' : review.mine ? '내 후기' : '사용자 후기'}
                  </span>
                  <strong>{showChallengeLink ? review.challengeTitle : review.memberDisplayName}</strong>
                </div>
                <ReviewStars value={review.rating} />
              </div>

              <p className="glass-list-item__description">{review.content}</p>

              <div className="glass-inline-meta">
                <span>{formatReviewDate(review.updatedAt)}</span>
                <span>{review.mine ? '수정 가능' : '공개 후기'}</span>
              </div>
            </div>

            <div className="glass-list-item__actions review-list-item__actions">
              {showChallengeLink ? (
                <Link className="button-link button-link--secondary" to={`/challenges/${review.challengeId}`}>
                  챌린지 보기
                </Link>
              ) : null}

              {hasBoardLink ? (
                <Link className="button-link" to={`/board/${review.boardPostId}`}>
                  게시판 후기
                </Link>
              ) : null}

              {!showChallengeLink && !hasBoardLink ? (
                <span className="glass-badge">{review.mine ? '내 후기' : '후기'}</span>
              ) : null}
            </div>
          </article>
        );
      })}
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

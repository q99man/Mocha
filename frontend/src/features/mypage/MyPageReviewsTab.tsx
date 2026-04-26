import { Fragment, type Dispatch, type SetStateAction } from 'react';

import { ReviewStars } from '../reviews/ReviewStars';
import { IconDelete, IconEdit, IconSave, IconView } from '../../shared/components/AdminIcons';
import { Pagination } from '../../shared/components/Pagination';
import type { Review, ReviewInput } from '../../shared/types/review';

type MyPageReviewsTabProps = {
  pagedReviews: Review[];
  expandedReviewId: number | null;
  editingReviewId: number | null;
  reviewForm: ReviewInput;
  reviewBusy: boolean;
  reviewPage: number;
  reviewTotalPages: number;
  challengeDifficultyById: Record<number, string>;
  setReviewForm: Dispatch<SetStateAction<ReviewInput>>;
  onReviewPageChange: (page: number) => void;
  onToggleReview: (reviewId: number) => void;
  onNavigateToChallenge: (challengeId: number) => void | Promise<void>;
  onStartReviewEdit: (review: Review) => void;
  onCancelReviewEdit: () => void;
  onRequestUpdateReview: (reviewId: number) => void;
  onDeleteReview: (reviewId: number) => void;
  formatDate: (value: string) => string;
};

export function MyPageReviewsTab({
  pagedReviews,
  expandedReviewId,
  editingReviewId,
  reviewForm,
  reviewBusy,
  reviewPage,
  reviewTotalPages,
  challengeDifficultyById,
  setReviewForm,
  onReviewPageChange,
  onToggleReview,
  onNavigateToChallenge,
  onStartReviewEdit,
  onCancelReviewEdit,
  onRequestUpdateReview,
  onDeleteReview,
  formatDate,
}: MyPageReviewsTabProps) {
  return (
    <>
      {pagedReviews.length === 0 ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>작성한 후기가 아직 없습니다.</strong>
          <p>챌린지에 참여하면 후기 버튼으로 바로 등록할 수 있습니다.</p>
        </div>
      ) : (
        <div className="admin-hub-compact-table mypage-compact-table">
          <div className="admin-hub-compact-table__head mypage-compact-table__head mypage-compact-table__head--reviews" role="presentation">
            <span>난이도</span>
            <span>제목</span>
            <span>별점</span>
            <span>작성일</span>
          </div>

          <div className="mypage-compact-table__body">
            {pagedReviews.map((review) => {
              const isExpanded = expandedReviewId === review.id;
              const isEditing = editingReviewId === review.id;

              return (
                <Fragment key={review.id}>
                  <article
                    className={`admin-hub-compact-row mypage-compact-row mypage-compact-row--reviews${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleReview(review.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleReview(review.id);
                      }
                    }}
                  >
                    <div className="mypage-compact-row__status">
                      <span className="board-compact-badge">{challengeDifficultyById[review.challengeId] ?? '-'}</span>
                    </div>
                    <div className="mypage-compact-row__title">
                      <button className="mypage-inline-trigger" type="button">
                        {review.challengeTitle}
                      </button>
                    </div>
                    <div className="mypage-compact-row__metric">★ {review.rating.toFixed(1)}</div>
                    <div className="mypage-compact-row__date">{formatDate(review.createdAt)}</div>
                  </article>

                  {isExpanded ? (
                    <section className="mypage-inline-detail">
                      <div className="mypage-inline-detail__header">
                        <div>
                          <strong>{review.challengeTitle}</strong>
                          <p>
                            {challengeDifficultyById[review.challengeId] ?? '-'} · 작성 {formatDate(review.createdAt)}
                          </p>
                        </div>
                        <div className="admin-action-group admin-action-group--inline">
                          <button
                            className="button-link button-link--secondary button-link--compact admin-action-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onNavigateToChallenge(review.challengeId);
                            }}
                          >
                            <IconView />
                            <span>챌린지 보기</span>
                          </button>
                          {!isEditing ? (
                            <>
                              <button
                                className="button-link button-link--secondary button-link--compact admin-action-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onStartReviewEdit(review);
                                }}
                              >
                                <IconEdit />
                                <span>수정</span>
                              </button>
                              <button
                                className="button-link button-link--secondary button-link--compact admin-action-button admin-hub-compact__action-btn--danger"
                                type="button"
                                disabled={reviewBusy}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteReview(review.id);
                                }}
                              >
                                <IconDelete />
                                <span>{reviewBusy ? '처리 중...' : '삭제'}</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="button-link button-link--secondary button-link--compact admin-action-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onCancelReviewEdit();
                                }}
                                disabled={reviewBusy}
                              >
                                <span>취소</span>
                              </button>
                              <button
                                className="button-link button-link--compact admin-action-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRequestUpdateReview(review.id);
                                }}
                                disabled={reviewBusy || !reviewForm.content.trim()}
                              >
                                <IconSave />
                                <span>{reviewBusy ? '수정 중...' : '저장'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {!isEditing ? (
                        <>
                          <div className="mypage-inline-meta">
                            <span>별점</span>
                            <ReviewStars value={review.rating} disabled />
                            <span>{review.rating.toFixed(1)}점</span>
                          </div>
                          <article className="mypage-inline-content">{review.content}</article>
                        </>
                      ) : (
                        <div className="mypage-inline-form">
                          <label className="mypage-inline-field">
                            <span>별점</span>
                            <div className="mypage-inline-stars">
                              <ReviewStars
                                value={reviewForm.rating}
                                disabled={reviewBusy}
                                onChange={(nextRating) =>
                                  setReviewForm((current) => ({ ...current, rating: nextRating }))
                                }
                              />
                              <strong>{reviewForm.rating.toFixed(1)}</strong>
                            </div>
                          </label>

                          <label className="mypage-inline-field">
                            <span>후기 내용</span>
                            <textarea
                              value={reviewForm.content}
                              rows={7}
                              disabled={reviewBusy}
                              maxLength={1200}
                              onChange={(event) => setReviewForm((current) => ({ ...current, content: event.target.value }))}
                            />
                          </label>
                        </div>
                      )}

                    </section>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Pagination currentPage={reviewPage} totalPages={reviewTotalPages} onPageChange={onReviewPageChange} />
    </>
  );
}

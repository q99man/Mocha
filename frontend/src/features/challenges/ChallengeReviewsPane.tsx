import type { Dispatch, SetStateAction } from 'react';

import { ReviewStars } from '../reviews/ReviewStars';
import type { Review, ReviewInput } from '../../shared/types/review';
import type { Challenge } from '../../shared/types/challenge';
import { IconArrowLeft, IconEdit } from '../../shared/components/AdminIcons';

type ChallengeReviewsPaneProps = {
  selectedChallenge: Challenge | null;
  isAuthenticated: boolean;
  hasAttemptedSelectedChallenge: boolean;
  hasMyReview: boolean;
  canWriteReview: boolean;
  reviewFormOpen: boolean;
  reviewForm: ReviewInput;
  reviewSubmitBusy: boolean;
  reviewLoading: boolean;
  reviewError: string | null;
  selectedChallengeReviews: Review[];
  editingReviewId: number | null;
  reviewEditForm: ReviewInput;
  reviewEditBusy: boolean;
  currentUserId: number | null | undefined;
  setReviewForm: Dispatch<SetStateAction<ReviewInput>>;
  setReviewEditForm: Dispatch<SetStateAction<ReviewInput>>;
  onToggleReviewForm: () => void;
  onOpenListPanel: () => void;
  onSubmitReview: () => void | Promise<void>;
  onStartReviewEdit: (review: Review) => void;
  onDeleteReview: (reviewId: number) => void;
  onCancelReviewEdit: () => void;
  onRequestReviewUpdate: (reviewId: number) => void;
  formatReviewDate: (value: string) => string;
  renderStars: (value: number) => string;
};

export function ChallengeReviewsPane({
  selectedChallenge,
  isAuthenticated,
  hasAttemptedSelectedChallenge,
  hasMyReview,
  canWriteReview,
  reviewFormOpen,
  reviewForm,
  reviewSubmitBusy,
  reviewLoading,
  reviewError,
  selectedChallengeReviews,
  editingReviewId,
  reviewEditForm,
  reviewEditBusy,
  currentUserId,
  setReviewForm,
  setReviewEditForm,
  onToggleReviewForm,
  onOpenListPanel,
  onSubmitReview,
  onStartReviewEdit,
  onDeleteReview,
  onCancelReviewEdit,
  onRequestReviewUpdate,
  formatReviewDate,
  renderStars,
}: ChallengeReviewsPaneProps) {
  return (
    <div className="song-select__review-panel">
      <div className="song-select__review-panel-header">
        <div>
          <strong>{selectedChallenge?.title ?? '챌린지 후기'}</strong>
          <span>참여자 후기를 바로 확인할 수 있습니다.</span>
        </div>
        <div className="song-select__review-panel-actions">
          {canWriteReview ? (
            <button
              type="button"
              className={`song-select__panel-btn song-select__panel-btn--icon-mobile${reviewFormOpen ? ' is-active' : ''}`}
              title={reviewFormOpen ? '작성 닫기' : '후기 작성'}
              onClick={onToggleReviewForm}
            >
              <IconEdit className="song-select__panel-btn-icon" />
              <span>{reviewFormOpen ? '작성 닫기' : '후기 작성'}</span>
            </button>
          ) : null}
          <button type="button" className="song-select__panel-btn song-select__panel-btn--icon-mobile" onClick={onOpenListPanel} title="목록으로">
            <IconArrowLeft className="song-select__panel-btn-icon" />
            <span>목록으로</span>
          </button>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="song-select__review-notice">로그인 후 도전한 챌린지에만 후기를 작성할 수 있습니다.</div>
      ) : !hasAttemptedSelectedChallenge ? (
        <div className="song-select__review-notice">내가 도전한 챌린지에만 후기를 작성할 수 있습니다.</div>
      ) : null}

      {reviewFormOpen ? (
        <form
          className="song-select__review-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitReview();
          }}
        >
          <div className="song-select__review-compose-head">
            <div>
              <strong>후기 작성</strong>
              <span>도전 경험을 바로 남겨 주세요.</span>
            </div>
            <div className="song-select__review-rating">
              <ReviewStars
                value={reviewForm.rating}
                disabled={reviewSubmitBusy}
                onChange={(nextRating) => setReviewForm((current) => ({ ...current, rating: nextRating }))}
              />
              <b>{reviewForm.rating.toFixed(1)}점</b>
            </div>
          </div>

          <label className="song-select__review-field">
            <span>후기 내용</span>
            <textarea
              value={reviewForm.content}
              rows={5}
              maxLength={1200}
              disabled={reviewSubmitBusy}
              placeholder="좋았던 점, 어려웠던 구간, 다시 도전할 때 참고할 내용을 적어 주세요."
              onChange={(event) => setReviewForm((current) => ({ ...current, content: event.target.value }))}
            />
          </label>

          <div className="song-select__review-compose-footer">
            <span>{reviewForm.content.trim().length}/1200</span>
            <div className="song-select__review-compose-buttons">
              <button type="button" className="song-select__panel-btn" onClick={onToggleReviewForm} disabled={reviewSubmitBusy}>
                취소
              </button>
              <button
                type="submit"
                className="song-select__item-review-btn"
                disabled={reviewSubmitBusy || !reviewForm.content.trim()}
              >
                {reviewSubmitBusy ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {reviewLoading ? (
        <div className="song-select__empty">
          <p>후기를 불러오는 중입니다.</p>
        </div>
      ) : reviewError ? (
        <div className="song-select__empty">
          <p>{reviewError}</p>
        </div>
      ) : selectedChallengeReviews.length === 0 ? (
        <div className="song-select__empty">
          <p>아직 등록된 후기가 없습니다.</p>
        </div>
      ) : (
        selectedChallengeReviews.map((review) => {
          const isMine = review.mine || (currentUserId != null && review.memberId === currentUserId);
          const isEditing = editingReviewId === review.id;

          return (
            <article className="song-select__review-card" key={review.id}>
              <div className="song-select__review-header">
                <div>
                  <strong>{review.memberDisplayName}</strong>
                  <span>{formatReviewDate(review.updatedAt)}</span>
                </div>
                <div className="song-select__review-header-side">
                  <span className="song-select__review-score">{renderStars(review.rating)}</span>
                  {isMine ? <span className="song-select__review-mine">내 후기</span> : null}
                </div>
              </div>

              {!isEditing ? (
                <>
                  <p className="song-select__review-content">{review.content}</p>
                  {isMine ? (
                    <div className="song-select__review-actions">
                      <button
                        type="button"
                        className="song-select__panel-btn"
                        onClick={() => onStartReviewEdit(review)}
                        disabled={reviewEditBusy}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="song-select__panel-btn song-select__panel-btn--danger"
                        onClick={() => onDeleteReview(review.id)}
                        disabled={reviewEditBusy}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="song-select__review-edit">
                  <div className="song-select__review-rating">
                    <ReviewStars
                      value={reviewEditForm.rating}
                      disabled={reviewEditBusy}
                      onChange={(nextRating) => setReviewEditForm((current) => ({ ...current, rating: nextRating }))}
                    />
                    <b>{reviewEditForm.rating.toFixed(1)}점</b>
                  </div>

                  <label className="song-select__review-field">
                    <span>후기 내용</span>
                    <textarea
                      value={reviewEditForm.content}
                      rows={5}
                      maxLength={1200}
                      disabled={reviewEditBusy}
                      onChange={(event) => setReviewEditForm((current) => ({ ...current, content: event.target.value }))}
                    />
                  </label>

                  <div className="song-select__review-compose-footer">
                    <span>{reviewEditForm.content.trim().length}/1200</span>
                    <div className="song-select__review-compose-buttons">
                      <button type="button" className="song-select__panel-btn" onClick={onCancelReviewEdit} disabled={reviewEditBusy}>
                        취소
                      </button>
                      <button
                        type="button"
                        className="song-select__item-review-btn"
                        onClick={() => onRequestReviewUpdate(review.id)}
                        disabled={reviewEditBusy || !reviewEditForm.content.trim()}
                      >
                        {reviewEditBusy ? '수정 중...' : '수정 완료'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}

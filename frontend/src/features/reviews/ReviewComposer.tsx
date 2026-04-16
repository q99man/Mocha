import type { FormEvent } from 'react';
import type { ReviewInput } from '../../shared/types/review';
import { ReviewStars } from './ReviewStars';

type ReviewComposerProps = {
  value: ReviewInput;
  busy: boolean;
  submitLabel: string;
  error: string | null;
  success: string | null;
  hasExistingReview: boolean;
  onChange: (nextValue: ReviewInput) => void;
  onSubmit: () => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function ReviewComposer({
  value,
  busy,
  submitLabel,
  error,
  success,
  hasExistingReview,
  onChange,
  onSubmit,
  onDelete,
}: ReviewComposerProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <form className="review-composer" onSubmit={(event) => void handleSubmit(event)}>
      <div className="review-composer__header">
        <div>
          <h3>{hasExistingReview ? '내 후기 수정' : '후기 남기기'}</h3>
          <p>챌린지를 시도한 뒤, 동작 난이도와 경험을 짧고 선명하게 남겨주세요.</p>
        </div>
        <div className="review-composer__score">
          <span>평점</span>
          <ReviewStars
            value={value.rating}
            disabled={busy}
            onChange={(nextRating) => onChange({ ...value, rating: nextRating })}
          />
        </div>
      </div>

      <label className="admin-form__field">
        <span>후기 내용</span>
        <textarea
          value={value.content}
          rows={5}
          maxLength={1200}
          disabled={busy}
          placeholder="예: 동작 타이밍은 어렵지만 가이드가 좋아서 반복 연습하기 좋았어요."
          onChange={(event) => onChange({ ...value, content: event.target.value })}
        />
      </label>

      <div className="review-composer__footer">
        <p className="review-composer__hint">{value.content.trim().length}/1200</p>
        <div className="inline-actions">
          {hasExistingReview && onDelete ? (
            <button className="button-link button-link--secondary" type="button" disabled={busy} onClick={() => void onDelete()}>
              후기 삭제
            </button>
          ) : null}
          <button className="button-link" type="submit" disabled={busy || !value.content.trim()}>
            {busy ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>

      {success ? <p className="review-composer__message review-composer__message--success">{success}</p> : null}
      {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}
    </form>
  );
}

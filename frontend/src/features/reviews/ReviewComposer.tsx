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
    <form className="glass-panel glass-panel--nested glass-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="glass-toolbar">
        <div>
          <h3 className="glass-section-title">{hasExistingReview ? '후기 수정' : '후기 작성'}</h3>
          <p className="glass-toolbar__note">직접 시도해 본 느낌과 동작 피드백을 짧고 분명하게 남겨 주세요.</p>
        </div>

        <div className="glass-select">
          <span>평점</span>
          <ReviewStars
            value={value.rating}
            disabled={busy}
            onChange={(nextRating) => onChange({ ...value, rating: nextRating })}
          />
        </div>
      </div>

      <label className="glass-field">
        <span>후기 내용</span>
        <textarea
          value={value.content}
          rows={5}
          maxLength={1200}
          disabled={busy}
          placeholder="무엇이 좋았는지, 어려웠는지, 다시 시도할 때 도움이 될 포인트를 적어 주세요."
          onChange={(event) => onChange({ ...value, content: event.target.value })}
        />
      </label>

      <div className="glass-toolbar">
        <p className="glass-toolbar__note">{value.content.trim().length}/1200</p>
        <div className="inline-actions">
          {hasExistingReview && onDelete ? (
            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={busy}
              onClick={() => void onDelete()}
            >
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

import { type FormEvent } from 'react';

type BoardCommentComposerProps = {
  value: string;
  busy: boolean;
  submitLabel: string;
  placeholder: string;
  error?: string | null;
  success?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export function BoardCommentComposer({
  value,
  busy,
  submitLabel,
  placeholder,
  error,
  success,
  onChange,
  onSubmit,
  onCancel,
}: BoardCommentComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="board-comment-editor" onSubmit={handleSubmit}>
      <label className="glass-field">
        <span>댓글</span>
        <textarea
          rows={3}
          maxLength={1200}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      {success ? <p className="review-composer__message review-composer__message--success">{success}</p> : null}
      {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}

      <div className="inline-actions board-actions-right">
        {onCancel ? (
          <button
            className="button-link button-link--secondary button-link--compact"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            취소
          </button>
        ) : null}
        <button
          className="button-link button-link--compact"
          type="submit"
          disabled={busy || value.trim().length === 0}
        >
          {busy ? '처리 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

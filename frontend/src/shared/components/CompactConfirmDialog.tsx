import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type CompactConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function CompactConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: CompactConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    document.body.classList.add('body--modal-open');
    return () => {
      document.body.classList.remove('body--modal-open');
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="compact-confirm" role="dialog" aria-modal="true" aria-labelledby="compact-confirm-title">
      <div className="compact-confirm__backdrop" onClick={busy ? undefined : onCancel} />
      <div className="compact-confirm__panel" onClick={(event) => event.stopPropagation()}>
        <div className="compact-confirm__header">
          <div>
            <h3 id="compact-confirm-title">{title}</h3>
            <p>{description}</p>
          </div>
        </div>

        <div className="compact-confirm__actions">
          <button
            type="button"
            className="button-link button-link--secondary compact-confirm__button"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button-link compact-confirm__button${tone === 'danger' ? ' compact-confirm__button--danger' : ''}`}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

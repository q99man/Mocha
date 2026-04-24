import { useEffect, useRef } from 'react';

type CompactToastProps = {
  message: string | null;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
};

export function CompactToast({ message, type = 'success', onClose, duration = 3500 }: CompactToastProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  return (
    <div className={`compact-toast compact-toast--${type}`} role="alert">
      <div className="compact-toast__icon">
        {type === 'success' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>
      <p className="compact-toast__message">{message}</p>
      <button className="compact-toast__close" onClick={onClose} aria-label="닫기">
        ×
      </button>
    </div>
  );
}

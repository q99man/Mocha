import { useId, useRef } from 'react';

type CompactFileFieldProps = {
  label: string;
  accept?: string;
  buttonLabel?: string;
  emptyLabel?: string;
  selectedFileName?: string | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
};

export function CompactFileField({
  label,
  accept,
  buttonLabel = '파일 선택',
  emptyLabel = '선택된 파일이 없습니다.',
  selectedFileName,
  disabled = false,
  onSelect,
}: CompactFileFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleOpenPicker() {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  }

  function handleClear(event: React.MouseEvent) {
    event.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onSelect(null);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenPicker();
    }
  }

  return (
    <div className="compact-field">
      <span className="compact-field__label">{label}</span>
      <input
        id={inputId}
        ref={inputRef}
        className="compact-file__native"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      <div
        className={`compact-file${disabled ? ' is-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpenPicker}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled}
      >
        <div className="compact-file__summary">
          <span>{buttonLabel}</span>
          <strong>{selectedFileName ?? emptyLabel}</strong>
        </div>
        {selectedFileName ? (
          <button
            type="button"
            className="compact-file__clear"
            onClick={handleClear}
            disabled={disabled}
            aria-label={`${label} 선택 해제`}
          >
            지우기
          </button>
        ) : null}
      </div>
    </div>
  );
}

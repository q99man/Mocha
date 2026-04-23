import { useEffect, useId, useMemo, useRef, useState } from 'react';

type CompactFilterOption<T extends string> = {
  value: T;
  label: string;
};

type CompactFilterDropdownProps<T extends string> = {
  label: string;
  value: T;
  options: CompactFilterOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export function CompactFilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  ariaLabel,
  disabled,
}: CompactFilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`admin-hub-compact__filter-select${className ? ` ${className}` : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <span className="admin-hub-compact__filter-label">{label}</span>
      <button
        className={`admin-hub-compact__filter-trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="admin-hub-compact__filter-value">{selectedOption?.label ?? ''}</span>
        <span className="admin-hub-compact__filter-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="admin-hub-compact__filter-menu" id={listboxId} role="listbox" aria-label={ariaLabel ?? label}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                className={`admin-hub-compact__filter-option${isSelected ? ' is-active' : ''}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="admin-hub-compact__filter-option-label">{option.label}</span>
                {isSelected ? (
                  <svg className="admin-hub-compact__filter-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

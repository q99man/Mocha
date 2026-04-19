type CompactSegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

type CompactSegmentedControlProps<T extends string | number> = {
  label: string;
  value: T;
  options: CompactSegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

export function CompactSegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: CompactSegmentedControlProps<T>) {
  return (
    <div className={className ? `compact-field ${className}` : 'compact-field'}>
      <span className="compact-field__label">{label}</span>
      <div className="compact-segmented" role="group" aria-label={label}>
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={String(option.value)}
              type="button"
              className={`compact-segmented__option${isActive ? ' is-active' : ''}`}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              aria-pressed={isActive}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

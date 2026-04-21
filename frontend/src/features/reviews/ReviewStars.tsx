type ReviewStarsProps = {
  value: number;
  onChange?: (nextValue: number) => void;
  disabled?: boolean;
};

const STAR_VALUES = [1, 2, 3, 4, 5];

export function ReviewStars({ value, onChange, disabled = false }: ReviewStarsProps) {
  return (
    <div className="review-stars" aria-label={`평점 ${value}점`}>
      {STAR_VALUES.map((starValue) => {
        const active = starValue <= value;
        const className = `review-stars__button${active ? ' is-active' : ''}`;

        if (!onChange) {
          return (
            <span key={starValue} className={className} aria-hidden="true">
              ★
            </span>
          );
        }

        return (
          <button
            key={starValue}
            className={className}
            type="button"
            disabled={disabled}
            aria-label={`${starValue}점 선택`}
            aria-pressed={active}
            onClick={() => onChange(starValue)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

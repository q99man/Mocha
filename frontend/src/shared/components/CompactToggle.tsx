type CompactToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function CompactToggle({ label, checked, onChange, disabled = false }: CompactToggleProps) {
  return (
    <button
      type="button"
      className={`compact-toggle${checked ? ' is-active' : ''}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="compact-toggle__track">
        <span className="compact-toggle__thumb" />
      </span>
      <span className="compact-toggle__label">{label}</span>
    </button>
  );
}

type FilterPillsProps = {
  label?: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  variant?: 'default' | 'accent' | 'clay';
};

const ACTIVE: Record<NonNullable<FilterPillsProps['variant']>, string> = {
  default: 'bg-[var(--gk-red)] text-white border-[var(--gk-red)]',
  accent: 'bg-[var(--gk-green)] text-white border-[var(--gk-green)]',
  clay: 'bg-[var(--gk-gold)] text-[var(--gk-bg)] border-[var(--gk-gold)]'
};

export function FilterPills({
  label,
  options,
  value,
  onChange,
  variant = 'default'
}: FilterPillsProps) {
  if (!options.length) return null;

  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-[10px] font-bold text-[var(--gk-red)] uppercase tracking-wider">
          {label}
        </p>
      ) : null}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
        role="group"
        aria-label={label || 'Filter options'}
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={active}
              className={[
                'shrink-0 rounded-sm px-3.5 py-2 text-xs font-bold uppercase tracking-wide border transition-all',
                active
                  ? ACTIVE[variant]
                  : 'bg-[var(--gk-surface-2)] text-[var(--gk-muted)] border-[var(--gk-line)] hover:text-[var(--gk-ink)] hover:border-[var(--gk-red)]/50'
              ].join(' ')}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FilterPills;

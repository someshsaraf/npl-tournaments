type FilterPillsProps = {
  label?: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  variant?: 'default' | 'accent' | 'clay';
};

const ACTIVE: Record<NonNullable<FilterPillsProps['variant']>, string> = {
  default: 'bg-[var(--pine-deep)] text-[var(--pine-lime)] shadow-sm',
  accent: 'bg-[var(--pine-leaf)] text-white shadow-sm',
  clay: 'bg-[var(--pine-clay)] text-white shadow-sm'
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
        <p className="text-xs font-semibold text-[var(--pine-muted)] uppercase tracking-wider">
          {label}
        </p>
      ) : null}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5"
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
                'shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
                active
                  ? ACTIVE[variant]
                  : 'bg-white text-[var(--pine-muted)] border border-[var(--pine-line)] hover:text-[var(--pine-deep)] hover:border-[var(--pine-leaf)]/40'
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

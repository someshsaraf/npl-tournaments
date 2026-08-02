type StatusBadgeProps = {
  status: 'live' | 'completed' | 'scheduled' | 'final' | 'on-court';
  pulse?: boolean;
};

const STYLES: Record<StatusBadgeProps['status'], string> = {
  live: 'bg-[var(--gk-red)]/20 text-[var(--gk-red)] border border-[var(--gk-red)]/30',
  'on-court': 'bg-[var(--gk-gold)]/15 text-[var(--gk-gold)] border border-[var(--gk-gold)]/30',
  completed: 'bg-[var(--gk-green)]/15 text-[var(--gk-green)] border border-[var(--gk-green)]/30',
  final: 'bg-[var(--gk-green)]/15 text-[var(--gk-green)] border border-[var(--gk-green)]/30',
  scheduled: 'bg-[var(--gk-surface-2)] text-[var(--gk-muted)] border border-[var(--gk-line)]'
};

const LABELS: Record<StatusBadgeProps['status'], string> = {
  live: 'Live',
  'on-court': 'On Court',
  completed: 'Final',
  final: 'Final',
  scheduled: 'Scheduled'
};

export function StatusBadge({ status, pulse = false }: StatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm',
        STYLES[status],
        pulse ? 'animate-pulse' : ''
      ].join(' ')}
    >
      {(status === 'live' || status === 'on-court') && pulse ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {LABELS[status]}
    </span>
  );
}

export default StatusBadge;

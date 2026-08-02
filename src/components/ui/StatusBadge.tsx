type StatusBadgeProps = {
  status: 'live' | 'completed' | 'scheduled' | 'final' | 'on-court';
  pulse?: boolean;
};

const STYLES: Record<StatusBadgeProps['status'], string> = {
  live: 'bg-[var(--pine-clay)]/15 text-[var(--pine-clay)]',
  'on-court': 'bg-[var(--pine-clay)]/15 text-[var(--pine-clay)]',
  completed: 'bg-[var(--pine-leaf)]/15 text-[var(--pine-leaf)]',
  final: 'bg-[var(--pine-leaf)]/15 text-[var(--pine-leaf)]',
  scheduled: 'bg-[var(--pine-mist)] text-[var(--pine-muted)]'
};

const LABELS: Record<StatusBadgeProps['status'], string> = {
  live: 'Live',
  'on-court': 'On court',
  completed: 'Completed',
  final: 'Final',
  scheduled: 'Scheduled'
};

export function StatusBadge({ status, pulse = false }: StatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full',
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

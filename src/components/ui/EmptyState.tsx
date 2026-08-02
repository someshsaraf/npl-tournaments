import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="portal-card flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="size-14 rounded-sm bg-[var(--gk-surface-2)] border border-[var(--gk-line)] flex items-center justify-center mb-4">
        <Icon className="size-7 text-[var(--gk-muted)]" aria-hidden />
      </div>
      <p className="portal-display text-lg text-[var(--gk-ink)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--gk-muted)] mt-2 max-w-sm">{description}</p>
      ) : null}
    </div>
  );
}

export default EmptyState;

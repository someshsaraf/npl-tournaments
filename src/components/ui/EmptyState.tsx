import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="portal-card flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="size-12 rounded-2xl bg-[var(--pine-mist)] flex items-center justify-center mb-3">
        <Icon className="size-6 text-[var(--pine-muted)]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[var(--pine-deep)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--pine-muted)] mt-1 max-w-xs">{description}</p>
      ) : null}
    </div>
  );
}

export default EmptyState;

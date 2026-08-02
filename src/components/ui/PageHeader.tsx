import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  label?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, label, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="space-y-2 min-w-0">
        {label ? <p className="portal-section-label">{label}</p> : null}
        <h1 className="portal-display text-4xl sm:text-5xl lg:text-6xl text-[var(--gk-ink)]">
          {title}
        </h1>
        <div className="h-0.5 w-16 bg-[var(--gk-red)]" aria-hidden />
        {description ? (
          <p className="text-sm text-[var(--gk-muted)] leading-relaxed pt-1">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export default PageHeader;

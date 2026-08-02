import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <h1 className="portal-display text-3xl sm:text-4xl lg:text-5xl text-[var(--pine-deep)]">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-[var(--pine-muted)] leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export default PageHeader;

import type { ReactNode } from 'react';
import { AdminNav } from './AdminNav';

type AdminShellProps = {
  children: ReactNode;
  subtitle?: string;
  hint?: string;
};

/**
 * Shared staff chrome: pine ops theme + top nav.
 * Stateless layout wrapper; pages own data/effects.
 */
export function AdminShell({ children, subtitle, hint }: AdminShellProps) {
  const safeHint = typeof hint === 'string' && hint.trim() ? hint.trim() : '';

  return (
    <div className="npl-admin min-h-screen text-[var(--admin-ink)]">
      <div className="admin-mesh min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-5 sm:py-8 space-y-6">
          <AdminNav subtitle={subtitle} />
          {safeHint ? (
            <p className="text-center text-[12px] text-[var(--admin-muted)] max-w-xl mx-auto -mt-2 leading-relaxed">
              {safeHint}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

export default AdminShell;

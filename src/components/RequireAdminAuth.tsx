import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Gates /admin/* and /scorer behind the admin code. The server enforces the
 * same rule on every write (server/rules.ts), so this is the UI half.
 */
export function RequireAdminAuth() {
  const { admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}

export default RequireAdminAuth;

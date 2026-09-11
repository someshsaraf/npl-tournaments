import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Gates /admin/* behind admin login. This protects the admin UI itself —
 * it does not by itself lock down the underlying Firebase writes those
 * pages make (those still use this app's existing open RTDB rules).
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

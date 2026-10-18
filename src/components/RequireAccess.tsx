import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Everything residents see — and the court score screens — needs the
 * community access code (or the admin code). Locked devices go to the code
 * screen at /,
 * which returns them here afterwards.
 */
export function RequireAccess() {
  const { access, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="fixed inset-0 bg-slate-950" />;
  if (!access) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

export default RequireAccess;

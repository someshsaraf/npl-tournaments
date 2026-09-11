import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminLogin } from '../utils/authClient';

const INPUT_CLASS =
  'w-full bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm px-3.5 py-2.5 rounded-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50';

/** Staff login — separate from the public user login, gates /admin/*. */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      await adminLogin(username.trim(), password);
      await refresh();
      navigate('/admin/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="text-center space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-indigo-400 font-semibold">
            Staff only
          </p>
          <h1 className="text-xl font-bold text-white">Admin login</h1>
        </div>
        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busy}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
              className={INPUT_CLASS}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 text-white font-bold text-sm px-4 py-2.5 hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Log in
          </button>
        </form>
        {error ? (
          <p className="text-xs text-red-400 font-medium text-center" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

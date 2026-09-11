import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Users as UsersIcon } from 'lucide-react';
import { AdminNav } from '../components/AdminNav';
import { adminListUsers, adminResetPin, type ManagedUser } from '../utils/authClient';

/**
 * Admin-only resident directory + PIN reset. Since registration skips email
 * verification, "forgot PIN" has no self-service path — an admin resets it
 * here after confirming the resident's identity out of band (in person,
 * phone, WhatsApp), then relays the newly generated PIN to them directly.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; newPin: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    adminListUsers()
      .then(setUsers)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleReset = async (user: ManagedUser) => {
    if (resettingUid) return;
    const ok = window.confirm(
      `Reset the PIN for "${user.username}"?\n\nOnly do this after confirming their identity directly (in person, phone, WhatsApp) - the new PIN will be shown once so you can relay it to them.`
    );
    if (!ok) return;

    setResettingUid(user.uid);
    setActionError(null);
    setResetResult(null);
    try {
      const res = await adminResetPin(user.uid);
      setResetResult({ username: res.username, newPin: res.newPin });
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reset PIN.');
    } finally {
      setResettingUid(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-4xl mx-auto">
      <AdminNav subtitle="Resident Accounts" />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-indigo-300 inline-flex items-center gap-2">
            <UsersIcon className="size-5" aria-hidden />
            Resident accounts
          </h1>
          <span className="text-xs text-slate-400 font-mono">{users.length} registered</span>
        </div>

        <p className="text-xs text-slate-500">
          There's no self-service "forgot PIN" flow. If a resident is locked out, confirm who they
          are yourself (in person, phone, WhatsApp), then reset their PIN below - a new one is
          generated and shown once for you to relay to them.
        </p>

        {resetResult ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-emerald-200">
              New PIN for <span className="font-bold">{resetResult.username}</span>:{' '}
              <span className="font-mono text-lg tracking-[0.2em] text-white">{resetResult.newPin}</span>
            </p>
            <button
              type="button"
              onClick={() => setResetResult(null)}
              className="text-[11px] text-emerald-300/80 hover:text-white font-bold uppercase"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {actionError ? (
          <p className="text-[11px] text-amber-300" role="alert">
            {actionError}
          </p>
        ) : null}
        {loadError ? (
          <p className="text-[11px] text-red-400" role="alert">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="text-sm">Loading…</span>
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">No residents have registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.uid}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100 truncate">
                    {user.username}
                    {user.locked ? (
                      <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40">
                        Locked
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  disabled={resettingUid === user.uid}
                  onClick={() => void handleReset(user)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:bg-indigo-500/25 disabled:opacity-50"
                >
                  {resettingUid === user.uid ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="size-3.5" aria-hidden />
                  )}
                  Reset PIN
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

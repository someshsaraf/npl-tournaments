import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';
import {
  getPlayerNameAliases,
  renamePlayerInTeams
} from '../utils/playerRename';

function normalizeTeams(raw: unknown): Team[] {
  if (!Array.isArray(raw)) return TEAMS;
  const cleaned = raw.filter(
    (t): t is Team =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as Team).id === 'string' &&
      typeof (t as Team).name === 'string' &&
      Array.isArray((t as Team).players)
  );
  const base = cleaned.length > 0 ? cleaned : TEAMS;
  let withAliases = base;
  for (const [from, to] of Object.entries(getPlayerNameAliases())) {
    withAliases = renamePlayerInTeams(withAliases, from, to);
  }
  return withAliases;
}

/**
 * Public team roster view. Reads Firebase `teams` when present; falls back to seed data.
 * No writes — team edits stay on /admin.
 */
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(TEAMS);

  useEffect(() => {
    const teamsRef = ref(db, 'teams');
    const unsub = onValue(teamsRef, (snap) => {
      setTeams(normalizeTeams(snap.val()));
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Teams</h1>
        <p className="text-sm text-slate-400">
          Team Championship rosters for NPL 2026 ({teams.length} teams).
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team, index) => {
          const players = Array.isArray(team.players) ? team.players : [];
          const accent =
            index % 5 === 0
              ? 'from-emerald-600/30'
              : index % 5 === 1
                ? 'from-amber-600/25'
                : index % 5 === 2
                  ? 'from-sky-600/25'
                  : index % 5 === 3
                    ? 'from-rose-600/25'
                    : 'from-teal-600/25';

          return (
            <article
              key={team.id || team.name}
              className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${accent} to-slate-900/80 overflow-hidden`}
            >
              <div className="px-4 pt-4 pb-3 border-b border-slate-800/80">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
                  Team Championship
                </p>
                <h2 className="portal-display text-2xl text-white tracking-wide mt-0.5">
                  {team.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{players.length} players</p>
              </div>
              <ol className="px-4 py-3 space-y-1.5">
                {players.length === 0 ? (
                  <li className="text-sm text-slate-500">No players listed.</li>
                ) : (
                  players.map((player, i) => (
                    <li
                      key={`${team.id}-${player}-${i}`}
                      className="flex items-baseline gap-2 text-sm text-slate-200"
                    >
                      <span className="font-mono text-[10px] text-slate-500 w-4 shrink-0">
                        {i + 1}
                      </span>
                      <span>{typeof player === 'string' ? player : '—'}</span>
                    </li>
                  ))
                )}
              </ol>
            </article>
          );
        })}
      </div>
    </div>
  );
}

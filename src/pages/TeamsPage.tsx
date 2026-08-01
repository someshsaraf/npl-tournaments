import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';

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
  return cleaned.length > 0 ? cleaned : TEAMS;
}

const ACCENTS = [
  'border-l-[var(--pine-leaf)]',
  'border-l-[var(--pine-clay)]',
  'border-l-[var(--pine-sky)]',
  'border-l-[var(--pine-lime)]',
  'border-l-[var(--pine-deep)]'
] as const;

/**
 * Public team roster view. Reads Firebase `teams` when present.
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
    <div className="portal-page space-y-6">
      <header className="space-y-1">
        <h1 className="portal-display text-4xl sm:text-5xl text-[var(--pine-deep)]">Teams</h1>
        <p className="text-sm text-[var(--pine-muted)]">
          Team Championship rosters · {teams.length} teams
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team, index) => {
          const players = Array.isArray(team.players) ? team.players : [];
          const accent = ACCENTS[index % ACCENTS.length];

          return (
            <article
              key={team.id || team.name}
              className={`rounded-2xl border border-[var(--pine-line)] border-l-4 ${accent} bg-[var(--pine-paper)] overflow-hidden shadow-sm`}
            >
              <div className="px-4 pt-4 pb-3 border-b border-[var(--pine-line)]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--pine-muted)] font-semibold">
                  Team Championship
                </p>
                <h2 className="portal-display text-2xl text-[var(--pine-deep)] mt-0.5">
                  {team.name}
                </h2>
                <p className="text-xs text-[var(--pine-muted)] mt-1">
                  {players.length} players
                </p>
              </div>
              <ol className="px-4 py-3 space-y-1.5">
                {players.length === 0 ? (
                  <li className="text-sm text-[var(--pine-muted)]">No players listed.</li>
                ) : (
                  players.map((player, i) => (
                    <li
                      key={`${team.id}-${player}-${i}`}
                      className="flex items-baseline gap-2 text-sm text-[var(--pine-ink)]"
                    >
                      <span className="font-mono text-[10px] text-[var(--pine-muted)] w-4 shrink-0">
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

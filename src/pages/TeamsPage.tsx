import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { Users } from 'lucide-react';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';
import { PageHeader } from '../components/ui/PageHeader';

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
  'border-t-[var(--pine-leaf)]',
  'border-t-[var(--pine-clay)]',
  'border-t-[var(--pine-sky)]',
  'border-t-[var(--pine-lime)]',
  'border-t-[var(--pine-deep)]'
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
      <PageHeader
        title="Teams"
        description={`Team Championship rosters · ${teams.length} teams`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team, index) => {
          const players = Array.isArray(team.players) ? team.players : [];
          const accent = ACCENTS[index % ACCENTS.length];

          return (
            <article
              key={team.id || team.name}
              className={`portal-card border-t-4 ${accent} overflow-hidden hover:shadow-md transition-shadow`}
            >
              <div className="px-4 pt-4 pb-3 border-b border-[var(--pine-line)] bg-[var(--pine-mist)]/40">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white border border-[var(--pine-line)] text-[var(--pine-deep)] shrink-0">
                    <Users className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--pine-muted)] font-semibold">
                      Team Championship
                    </p>
                    <h2 className="portal-display text-xl sm:text-2xl text-[var(--pine-deep)] mt-0.5 leading-tight">
                      {team.name}
                    </h2>
                    <p className="text-xs text-[var(--pine-muted)] mt-1">
                      {players.length} player{players.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </div>
              <ol className="px-4 py-3 space-y-2">
                {players.length === 0 ? (
                  <li className="text-sm text-[var(--pine-muted)]">No players listed.</li>
                ) : (
                  players.map((player, i) => (
                    <li
                      key={`${team.id}-${player}-${i}`}
                      className="flex items-center gap-3 text-sm text-[var(--pine-ink)]"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-[var(--pine-mist)] font-mono text-[10px] font-bold text-[var(--pine-muted)] shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium">{typeof player === 'string' ? player : '—'}</span>
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

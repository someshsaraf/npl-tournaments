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

/**
 * Goalkick team-single style roster cards.
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
    <div className="portal-page space-y-8">
      <PageHeader
        label="Rosters"
        title="Teams"
        description={`Team Championship · ${teams.length} teams`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((team, index) => {
          const players = Array.isArray(team.players) ? team.players : [];

          return (
            <article
              key={team.id || team.name}
              className="portal-card overflow-hidden gk-stripe hover:border-[var(--gk-red)]/40 transition-colors"
            >
              <div className="relative h-28 bg-[var(--gk-surface-2)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--gk-red)]/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gk-red)]">
                    Team {String.fromCharCode(65 + (index % 26))}
                  </p>
                  <h2 className="portal-display text-2xl sm:text-3xl text-[var(--gk-ink)] leading-tight">
                    {team.name}
                  </h2>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--gk-line)]">
                  <Users className="size-4 text-[var(--gk-muted)]" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--gk-muted)]">
                    {players.length} Players
                  </span>
                </div>
                <ol className="space-y-2">
                  {players.length === 0 ? (
                    <li className="text-sm text-[var(--gk-muted)]">No players listed.</li>
                  ) : (
                    players.map((player, i) => (
                      <li
                        key={`${team.id}-${player}-${i}`}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="flex size-7 items-center justify-center rounded-sm bg-[var(--gk-surface-2)] border border-[var(--gk-line)] font-mono text-[10px] font-bold text-[var(--gk-red)] shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-[var(--gk-ink)]">
                          {typeof player === 'string' ? player : '—'}
                        </span>
                      </li>
                    ))
                  )}
                </ol>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

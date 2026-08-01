import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';
import { AdminShell } from '../components/AdminShell';

/**
 * Admin team roster editor. Writes to Firebase `teams`.
 */
export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>(TEAMS);

  useEffect(() => {
    const teamsRef = ref(db, 'teams');
    const unsub = onValue(teamsRef, (snapshot) => {
      const data = snapshot.val();
      if (Array.isArray(data) && data.length > 0) {
        setTeams(data);
      } else {
        set(ref(db, 'teams'), TEAMS).catch((err) => console.error('Firebase write error:', err));
      }
    });
    return () => unsub();
  }, []);

  const updateTeamsState = (newTeams: Team[]) => {
    if (!Array.isArray(newTeams)) return;
    setTeams(newTeams);
    set(ref(db, 'teams'), newTeams).catch((err) => {
      console.error('Failed to sync teams to Firebase:', err);
    });
  };

  const handleTeamNameChange = (teamId: string, newName: string) => {
    if (typeof teamId !== 'string' || !teamId.trim()) return;
    const name = typeof newName === 'string' ? newName.slice(0, 80) : '';
    updateTeamsState(teams.map((t) => (t.id === teamId ? { ...t, name } : t)));
  };

  const handlePlayerNameChange = (teamId: string, playerIndex: number, newName: string) => {
    if (typeof teamId !== 'string' || !Number.isInteger(playerIndex) || playerIndex < 0) return;
    const name = typeof newName === 'string' ? newName.slice(0, 80) : '';
    updateTeamsState(
      teams.map((t) => {
        if (t.id !== teamId) return t;
        const updatedPlayers = [...t.players];
        if (playerIndex >= updatedPlayers.length) return t;
        updatedPlayers[playerIndex] = name;
        return { ...t, players: updatedPlayers };
      })
    );
  };

  const handleAddPlayer = (teamId: string) => {
    if (typeof teamId !== 'string' || !teamId.trim()) return;
    updateTeamsState(
      teams.map((t) =>
        t.id === teamId ? { ...t, players: [...t.players, 'New Player'] } : t
      )
    );
  };

  const handleRemovePlayer = (teamId: string, playerIndex: number) => {
    if (typeof teamId !== 'string' || !Number.isInteger(playerIndex) || playerIndex < 0) return;
    updateTeamsState(
      teams.map((t) => {
        if (t.id !== teamId) return t;
        return { ...t, players: t.players.filter((_, idx) => idx !== playerIndex) };
      })
    );
  };

  return (
    <AdminShell subtitle="Teams">
      <section className="admin-panel p-5 sm:p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-[var(--admin-line)] pb-3">
          <h1 className="admin-display text-xl text-[var(--admin-lime)]">
            Editable Teams &amp; Rosters
          </h1>
          <span className="text-xs text-[var(--admin-muted)]">Click any name to edit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-black/20 border border-[var(--admin-line)] p-3 rounded-xl space-y-3"
            >
              <input
                type="text"
                value={team.name}
                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                maxLength={80}
                className="w-full bg-black/30 border border-[var(--admin-line)] text-[var(--admin-lime)] font-bold text-sm px-2 py-1 rounded focus:outline-none focus:border-[var(--admin-lime)]"
                placeholder="Team Name"
              />

              <div className="space-y-1.5">
                {team.players.map((player, idx) => (
                  <div key={`${team.id}-${idx}`} className="flex items-center space-x-1 group">
                    <input
                      type="text"
                      value={player}
                      onChange={(e) => handlePlayerNameChange(team.id, idx, e.target.value)}
                      maxLength={80}
                      className="w-full bg-black/25 border border-[var(--admin-line)] text-xs text-[var(--admin-ink)] px-2 py-1 rounded focus:outline-none focus:border-[var(--admin-teal)]"
                      placeholder={`Player ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(team.id, idx)}
                      className="text-[var(--admin-clay)] hover:brightness-125 px-1 text-xs font-bold opacity-70 group-hover:opacity-100 transition-opacity"
                      title="Remove Player"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleAddPlayer(team.id)}
                className="w-full text-center text-[11px] text-[var(--admin-teal)] hover:brightness-110 bg-[var(--admin-teal)]/10 border border-[var(--admin-teal)]/30 rounded py-1 font-semibold transition-[filter]"
              >
                + Add Player
              </button>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

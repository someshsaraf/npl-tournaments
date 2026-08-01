import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';
import { AdminNav } from '../components/AdminNav';

/**
 * Admin team roster editor. Moved off the main /admin schedule page.
 * Writes to Firebase `teams`; validates array shape before update.
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">
      <AdminNav subtitle="Teams" />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-indigo-300">Editable Teams &amp; Rosters</h1>
          <span className="text-xs text-slate-400">Click any name to edit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl space-y-3"
            >
              <input
                type="text"
                value={team.name}
                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                maxLength={80}
                className="w-full bg-slate-900/90 border border-slate-700/80 text-amber-400 font-bold text-sm px-2 py-1 rounded focus:outline-none focus:border-amber-400"
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
                      className="w-full bg-slate-900/60 border border-slate-800 text-xs text-slate-200 px-2 py-1 rounded focus:outline-none focus:border-indigo-500"
                      placeholder={`Player ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(team.id, idx)}
                      className="text-red-400 hover:text-red-300 px-1 text-xs font-bold opacity-70 group-hover:opacity-100 transition-opacity"
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
                className="w-full text-center text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 rounded py-1 font-semibold transition-colors"
              >
                + Add Player
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

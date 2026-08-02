import { useEffect, useRef, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { TEAMS, type Team } from '../data/tournamentData';
import { AdminNav } from '../components/AdminNav';
import { propagatePlayerRename } from '../utils/playerRename';

/**
 * Admin team roster editor. Moved off the main /admin schedule page.
 * Writes to Firebase `teams`; player renames also cascade to completed matches
 * and the live currentMatch so Results / Ask / overlays stay in sync.
 */
export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>(TEAMS);
  const [renameStatus, setRenameStatus] = useState<string | null>(null);
  const [isPropagating, setIsPropagating] = useState(false);
  /** Name captured on focus so blur can cascade old → new. */
  const focusNameRef = useRef<{ teamId: string; index: number; name: string } | null>(null);

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

  const handlePlayerFocus = (teamId: string, playerIndex: number, name: string) => {
    if (typeof teamId !== 'string' || !Number.isInteger(playerIndex) || playerIndex < 0) return;
    focusNameRef.current = {
      teamId,
      index: playerIndex,
      name: typeof name === 'string' ? name.trim() : ''
    };
  };

  /**
   * On blur: if the player name changed, rewrite that name across completed matches,
   * currentMatch, and any other roster occurrences.
   */
  const handlePlayerBlur = async (teamId: string, playerIndex: number, rawName: string) => {
    const focused = focusNameRef.current;
    focusNameRef.current = null;
    if (!focused || focused.teamId !== teamId || focused.index !== playerIndex) return;

    const oldName = focused.name;
    const newName = typeof rawName === 'string' ? rawName.trim().slice(0, 80) : '';
    if (!oldName || !newName || oldName === newName) return;

    setIsPropagating(true);
    setRenameStatus(null);
    try {
      const result = await propagatePlayerRename(db, oldName, newName);
      const bits = [
        result.completedUpdated > 0
          ? `${result.completedUpdated} completed match${result.completedUpdated === 1 ? '' : 'es'}`
          : null,
        result.currentMatchUpdated ? 'live match' : null,
        result.teamsUpdated ? 'rosters' : null
      ].filter(Boolean);
      setRenameStatus(
        bits.length > 0
          ? `Renamed “${oldName}” → “${newName}” in ${bits.join(', ')}.`
          : `Saved “${newName}” (no other records needed updating).`
      );
    } catch (err) {
      console.error('Failed to propagate player rename:', err);
      setRenameStatus('Failed to update completed matches. Check connection and try again.');
    } finally {
      setIsPropagating(false);
    }
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-indigo-300">Editable Teams &amp; Rosters</h1>
          <span className="text-xs text-slate-400">
            Edit a name, then leave the field — updates Results &amp; live score too
          </span>
        </div>

        {(isPropagating || renameStatus) && (
          <p
            className={`text-[11px] ${
              renameStatus?.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isPropagating ? 'Updating completed matches and live score…' : renameStatus}
          </p>
        )}

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
                      onFocus={() => handlePlayerFocus(team.id, idx, player)}
                      onBlur={(e) => void handlePlayerBlur(team.id, idx, e.target.value)}
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

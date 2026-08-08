import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import TeamsPage from './pages/TeamsPage';
import ResultsPage from './pages/ResultsPage';
import RulesPage from './pages/RulesPage';
import AskPage from './pages/AskPage';
import AdminPanel from './pages/AdminPanel';
import AdminScorePage from './pages/AdminScorePage';
import AdminResultsPage from './pages/AdminResultsPage';
import AdminTeamsPage from './pages/AdminTeamsPage';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import ScoreControl from './pages/ScoreControl';
import AdsTestPage from './pages/AdsTestPage';
import { db } from './firebase';
import {
  migrateLegacyPlayerNames,
  subscribePlayerNameAliases
} from './utils/playerRename';

/**
 * Public portal routes sit under PublicLayout (nav visible).
 * /admin* and /scorer are staff-only — not linked in portal nav.
 * /live is linked from portal; /score remains available by direct URL for displays.
 */
export default function App() {
  useEffect(() => {
    const unsubAliases = subscribePlayerNameAliases(db);
    void migrateLegacyPlayerNames(db).catch((err) => {
      console.error('Player name migration failed:', err);
    });
    return () => unsubAliases();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/ask" element={<AskPage />} />
        </Route>

        {/* Immersive displays (no portal chrome) */}
        <Route path="/score" element={<LiveScoreboard />} />
        <Route path="/live" element={<StreamOverlay />} />
        <Route path="/ads" element={<AdsTestPage />} />

        {/* Staff-only — not in public nav */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/score" element={<AdminScorePage />} />
        <Route path="/admin/results" element={<AdminResultsPage />} />
        <Route path="/admin/teams" element={<AdminTeamsPage />} />
        <Route path="/scorer" element={<ScoreControl />} />

        {/* Legacy redirects */}
        <Route path="/overlay" element={<Navigate to="/live" replace />} />
        <Route path="/score-control" element={<Navigate to="/scorer" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

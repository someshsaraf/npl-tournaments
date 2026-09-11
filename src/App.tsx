import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout';
import HomePage from './pages/HomePage';
import EventDetailPage from './pages/EventDetailPage';
import AskPage from './pages/AskPage';
import AboutPage from './pages/AboutPage';
import MatchPhotosPage from './pages/MatchPhotosPage';
import AdminPanel from './pages/AdminPanel';
import AdminScorePage from './pages/AdminScorePage';
import AdminResultsPage from './pages/AdminResultsPage';
import AdminPhotosPage from './pages/AdminPhotosPage';
import AdminTeamsPage from './pages/AdminTeamsPage';
import AdminEventsPage from './pages/AdminEventsPage';
import AdminEventConfigPage from './pages/AdminEventConfigPage';
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
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/photos" element={<MatchPhotosPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>

        {/* Immersive displays (no portal chrome) */}
        <Route path="/score" element={<LiveScoreboard />} />
        <Route path="/live" element={<StreamOverlay />} />
        <Route path="/ads" element={<AdsTestPage />} />

        {/* Staff-only — not in public nav */}
        <Route path="/admin" element={<Navigate to="/admin/events" replace />} />
        <Route path="/admin/tournament" element={<AdminPanel />} />
        <Route path="/admin/score" element={<AdminScorePage />} />
        <Route path="/admin/results" element={<AdminResultsPage />} />
        <Route path="/admin/photos" element={<AdminPhotosPage />} />
        <Route path="/admin/teams" element={<AdminTeamsPage />} />
        <Route path="/admin/events" element={<AdminEventsPage />} />
        <Route path="/admin/events/:id" element={<AdminEventConfigPage />} />
        <Route path="/scorer" element={<ScoreControl />} />

        {/* Legacy redirects — Schedule/Teams/Results/Stats/Rules/Recordings moved
            into each sport's event page (/events/:id) */}
        <Route path="/overlay" element={<Navigate to="/live" replace />} />
        <Route path="/score-control" element={<Navigate to="/scorer" replace />} />
        <Route path="/events" element={<Navigate to="/" replace />} />
        <Route path="/schedule" element={<Navigate to="/" replace />} />
        <Route path="/teams" element={<Navigate to="/" replace />} />
        <Route path="/results" element={<Navigate to="/" replace />} />
        <Route path="/stats" element={<Navigate to="/" replace />} />
        <Route path="/rules" element={<Navigate to="/" replace />} />
        <Route path="/recordings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout';
import { RequireAdminAuth } from './components/RequireAdminAuth';
import { RequireAccess } from './components/RequireAccess';
import AccessPage from './pages/AccessPage';
import AdminAccessPage from './pages/AdminAccessPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import BadmintonHubPage from './pages/BadmintonHubPage';
import LawnTennisHubPage from './pages/LawnTennisHubPage';
import TableTennisPage from './pages/TableTennisPage';
import AskPage from './pages/AskPage';
import AboutPage from './pages/AboutPage';
import AdminLoginPage from './pages/AdminLoginPage';
import MatchPhotosPage from './pages/MatchPhotosPage';
import AdminPanel from './pages/AdminPanel';
import AdminScorePage from './pages/AdminScorePage';
import AdminResultsPage from './pages/AdminResultsPage';
import AdminPhotosPage from './pages/AdminPhotosPage';
import AdminTeamsPage from './pages/AdminTeamsPage';
import AdminSportsPage from './pages/AdminSportsPage';
import AdminLawnTennisPage from './pages/AdminLawnTennisPage';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import ScoreControl from './pages/ScoreControl';
import AdsTestPage from './pages/AdsTestPage';
import { db } from './db';
import {
  migrateLegacyPlayerNames,
  subscribePlayerNameAliases
} from './utils/playerRename';

/**
 * Player-name aliases need data access, so they start once the device is
 * unlocked; the one-off legacy rename writes data, so only staff run it.
 */
function PlayerAliasSync() {
  const { access, admin } = useAuth();
  useEffect(() => {
    if (!access) return;
    const unsubAliases = subscribePlayerNameAliases(db);
    if (admin) {
      void migrateLegacyPlayerNames(db).catch((err) => {
        console.error('Player name migration failed:', err);
      });
    }
    return () => unsubAliases();
  }, [access, admin]);
  return null;
}

/** Old /access links (with ?next=) now land on the code screen at /. */
function AccessRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/${search}`} replace />;
}

/**
 * Access is by shared code, no accounts:
 * - / always shows the code screen. The community code unlocks the portal
 *   (sport picker at /sports, sport hubs, photos) and the court screens
 *   (/score/:sport, /live/:sport); the admin code also works there and opens
 *   the staff tools. Locked deep links come back via ?next=. See RequireAccess.
 * - /admin/login takes the fixed admin code; it unlocks /admin/* and the
 *   /scorer tablet. See RequireAdminAuth.
 * Display screens take an optional sport (/score/lawn-tennis); without one
 * they're badminton.
 */
export default function App() {
  return (
    <AuthProvider>
      <PlayerAliasSync />
      <BrowserRouter>
        <Routes>
          {/* Entry point: always the code screen. Community code → /sports,
              admin code → /admin/sports (or back to a deep link via ?next=). */}
          <Route path="/" element={<AccessPage />} />
          <Route path="/access" element={<AccessRedirect />} />

          <Route element={<RequireAccess />}>
            <Route element={<PublicLayout />}>
              <Route path="/sports" element={<HomePage />} />
              <Route path="/badminton" element={<BadmintonHubPage />} />
              <Route path="/lawn-tennis" element={<LawnTennisHubPage />} />
              <Route path="/table-tennis" element={<TableTennisPage />} />
              <Route path="/photos" element={<MatchPhotosPage />} />
              <Route path="/ask" element={<AskPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Route>

            {/* Immersive displays (no portal chrome) — court TVs enter the code once. */}
            <Route path="/score" element={<LiveScoreboard />} />
            <Route path="/score/:sport" element={<LiveScoreboard />} />
            <Route path="/live" element={<StreamOverlay />} />
            <Route path="/live/:sport" element={<StreamOverlay />} />
            <Route path="/ads" element={<AdsTestPage />} />
          </Route>

          {/* Staff-only — not in public nav */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<RequireAdminAuth />}>
            <Route path="/admin" element={<Navigate to="/admin/sports" replace />} />
            <Route path="/admin/sports" element={<AdminSportsPage />} />
            <Route path="/admin/lawn-tennis" element={<AdminLawnTennisPage />} />
            <Route path="/admin/tournament" element={<AdminPanel />} />
            <Route path="/admin/score" element={<AdminScorePage />} />
            <Route path="/admin/results" element={<AdminResultsPage />} />
            <Route path="/admin/photos" element={<AdminPhotosPage />} />
            <Route path="/admin/teams" element={<AdminTeamsPage />} />
            <Route path="/admin/events/*" element={<Navigate to="/admin/sports" replace />} />
            <Route path="/admin/access" element={<AdminAccessPage />} />
            <Route path="/admin/users" element={<Navigate to="/admin/access" replace />} />
            {/* Court scorer tablet — writes scores, so staff login is required. */}
            <Route path="/scorer" element={<ScoreControl />} />
            <Route path="/scorer/:sport" element={<ScoreControl />} />
          </Route>


          {/* Legacy redirects — resident accounts and community events were removed */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/forgot-pin" element={<Navigate to="/" replace />} />
          <Route path="/events/badminton-tournament" element={<Navigate to="/badminton" replace />} />
          <Route path="/events/tennis-tournament" element={<Navigate to="/lawn-tennis" replace />} />
          <Route path="/events/*" element={<Navigate to="/sports" replace />} />
          <Route path="/tennis" element={<Navigate to="/lawn-tennis" replace />} />
          <Route path="/overlay" element={<Navigate to="/live" replace />} />
          <Route path="/score-control" element={<Navigate to="/scorer" replace />} />
          <Route path="/events" element={<Navigate to="/sports" replace />} />
          <Route path="/schedule" element={<Navigate to="/sports" replace />} />
          <Route path="/teams" element={<Navigate to="/sports" replace />} />
          <Route path="/results" element={<Navigate to="/sports" replace />} />
          <Route path="/stats" element={<Navigate to="/sports" replace />} />
          <Route path="/rules" element={<Navigate to="/sports" replace />} />
          <Route path="/recordings" element={<Navigate to="/sports" replace />} />

          <Route path="*" element={<Navigate to="/sports" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import TeamsPage from './pages/TeamsPage';
import RulesPage from './pages/RulesPage';
import AdminPanel from './pages/AdminPanel';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import ScoreControl from './pages/ScoreControl';

/**
 * Public portal routes sit under PublicLayout (nav visible).
 * /admin and /scorer are siblings — reachable by URL only, never linked in portal nav.
 * /score and /live stay full-bleed for display / cinema use; linked from portal nav.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>

        {/* Immersive public displays (linked from portal; no chrome) */}
        <Route path="/score" element={<LiveScoreboard />} />
        <Route path="/live" element={<StreamOverlay />} />

        {/* Staff-only — not in public nav */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/scorer" element={<ScoreControl />} />

        {/* Legacy redirects */}
        <Route path="/overlay" element={<Navigate to="/live" replace />} />
        <Route path="/score-control" element={<Navigate to="/scorer" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

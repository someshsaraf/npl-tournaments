import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout';
import HomePage from './pages/HomePage';
import SchedulePage from './pages/SchedulePage';
import TeamsPage from './pages/TeamsPage';
import ResultsPage from './pages/ResultsPage';
import RulesPage from './pages/RulesPage';
import AdminPanel from './pages/AdminPanel';
import AdminScorePage from './pages/AdminScorePage';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import ScoreControl from './pages/ScoreControl';

/**
 * Public portal routes sit under PublicLayout (nav visible).
 * /admin (+ /admin/score) and /scorer are staff-only — not linked in portal nav.
 * /live is linked from portal; /score remains available by direct URL for displays.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>

        {/* Immersive displays (no portal chrome) */}
        <Route path="/score" element={<LiveScoreboard />} />
        <Route path="/live" element={<StreamOverlay />} />

        {/* Staff-only — not in public nav */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/score" element={<AdminScorePage />} />
        <Route path="/scorer" element={<ScoreControl />} />

        {/* Legacy redirects */}
        <Route path="/overlay" element={<Navigate to="/live" replace />} />
        <Route path="/score-control" element={<Navigate to="/scorer" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

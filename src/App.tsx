import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import RulesPage from './pages/RulesPage';
import ScoreControl from './pages/ScoreControl';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Audience scoreboard (was /live) */}
        <Route path="/" element={<Navigate to="/score" replace />} />
        <Route path="/score" element={<LiveScoreboard />} />

        {/* Court scorer (was /score) */}
        <Route path="/scorer" element={<ScoreControl />} />

        {/* Stream overlay (was /overlay) */}
        <Route path="/live" element={<StreamOverlay />} />

        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/rules" element={<RulesPage />} />

        {/* Legacy redirects */}
        <Route path="/overlay" element={<Navigate to="/live" replace />} />
        <Route path="/score-control" element={<Navigate to="/scorer" replace />} />

        <Route path="*" element={<Navigate to="/score" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import LiveScoreboard from './pages/LiveScoreboard';
import StreamOverlay from './pages/StreamOverlay';
import RulesPage from './pages/RulesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LiveScoreboard />} />
        <Route path="/live" element={<LiveScoreboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/overlay" element={<StreamOverlay />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

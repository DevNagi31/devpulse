import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Dashboard } from './pages/Dashboard';
import { PRs } from './pages/PRs';
import { Team } from './pages/Team';
import { Ask } from './pages/Ask';

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/prs" element={<PRs />} />
          <Route path="/team" element={<Team />} />
          <Route path="/ask" element={<Ask />} />
        </Routes>
      </main>
    </div>
  );
}

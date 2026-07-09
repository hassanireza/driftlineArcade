import { HashRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SkyfoldPage } from './games/skyfold/SkyfoldPage';
import { VoidrunnerPage } from './games/voidrunner/VoidrunnerPage';
import './styles/home.css';

/**
 * App
 *
 * Top-level composition root. HashRouter is used so the production build
 * can be served as static files from GitHub Pages without any server-side
 * rewrite rules for client-side routes.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/skyfold" element={<SkyfoldPage />} />
        <Route path="/voidrunner" element={<VoidrunnerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}

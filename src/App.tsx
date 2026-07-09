import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SkyfoldPage } from './games/skyfold/SkyfoldPage';
import { VoidrunnerPage } from './games/voidrunner/VoidrunnerPage';
import './styles/home.css';

/**
 * App
 *
 * Top-level composition root. BrowserRouter is used so routes render as
 * clean paths (e.g. /driftlineArcade/skyfold) instead of a hash fragment.
 * GitHub Pages has no server-side rewrites, so a 404.html redirect trick
 * (see public/404.html + the restore script in index.html) reconstructs
 * the intended path on direct loads and refreshes.
 */
export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/skyfold" element={<SkyfoldPage />} />
        <Route path="/voidrunner" element={<VoidrunnerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

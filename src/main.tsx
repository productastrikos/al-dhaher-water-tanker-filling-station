import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles/index.css';
import Shell from './shell/Shell';

// The driver app is a separate route (/mobile) and its own chunk (loads mobile.css only when opened).
const MobileApp = lazy(() => import('./mobile/MobileApp'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/mobile" element={<Suspense fallback={null}><MobileApp /></Suspense>} />
        <Route path="*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

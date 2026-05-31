import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from '@/pages/App';
import { AuthProvider } from '@/auth/AuthProvider';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import '@/styles/index.css';

// Lazy load all secondary routes for code splitting
const GalleryPage = lazy(() => import('@/gallery/GalleryPage'));
const RecordingPage = lazy(() => import('@/pages/RecordingPage'));
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettingsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const TermsPage = lazy(() =>
  import('@/pages/LegalPages').then((m) => ({ default: m.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/LegalPages').then((m) => ({ default: m.PrivacyPage })),
);
const MidiSettingsPage = lazy(
  () => import('@/midi/components/MidiSettingsPage'),
);
const PiecePage = lazy(() => import('@/pages/PiecePage'));
const ListeningSessionPage = lazy(() => import('@/pages/ListeningSessionPage'));
const MeditationTimerPage = lazy(() => import('@/pages/MeditationTimerPage'));
const SessionHistoryPage = lazy(() => import('@/history/SessionHistoryPage'));
const LibraryPage = lazy(() => import('@/library/LibraryPage'));
const ExperimentRunner = lazy(() =>
  import('@/experiment/ExperimentRunner').then((m) => ({
    default: m.ExperimentRunner,
  })),
);
const SubjectRunner = lazy(() =>
  import('@/clinical/SubjectRunner').then((m) => ({
    default: m.SubjectRunner,
  })),
);
const ReproducerPage = lazy(() => import('@/studies/export/ReproducerPage'));
import { BridgeServer } from '@/research/bridge/BridgeServer';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

// Performance mark for boot start
if (typeof window !== 'undefined') {
  performance.mark('app-init-start');

  // Setup global web-vitals capture for audits
  const win = window as typeof window & {
    __web_vitals__?: Record<string, number>;
  };
  win.__web_vitals__ = {};
  const saveVital = (metric: { name: string; value: number }) => {
    if (win.__web_vitals__) {
      win.__web_vitals__[metric.name] = metric.value;
    }
    console.log(`[Web Vitals] ${metric.name}:`, metric.value);
  };
  try {
    onCLS(saveVital);
    onFCP(saveVital);
    onINP(saveVital);
    onLCP(saveVital);
    onTTFB(saveVital);
  } catch (e) {
    console.error('Failed to initialize web-vitals:', e);
  }

  BridgeServer.start();
}

// Lazy load the AdminPage conditionally to tree-shake it out of mobile builds
const AdminPage = import.meta.env.VITE_MOBILE
  ? () => null
  : lazy(() => import('@/admin/AdminPage'));

import { JamProvider } from '@/jam/JamProvider';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <DeepLinkHandler />
      <AuthProvider>
        <JamProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/p/:slug" element={<App />} />
              <Route path="/jam/:id" element={<App />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/midi" element={<MidiSettingsPage />} />
              <Route path="/piece" element={<PiecePage />} />
              <Route path="/piece/:slug" element={<PiecePage />} />
              <Route
                path="/listening/:slug"
                element={<ListeningSessionPage />}
              />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/r/:slug" element={<RecordingPage />} />
              <Route path="/account" element={<AccountSettingsPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/u/:account_id" element={<ProfilePage />} />
              <Route path="/legal/terms" element={<TermsPage />} />
              <Route path="/legal/privacy" element={<PrivacyPage />} />
              <Route path="/timer" element={<MeditationTimerPage />} />
              <Route path="/me/sessions" element={<SessionHistoryPage />} />
              <Route path="/listen" element={<LibraryPage />} />
              <Route
                path="/experiment/preview"
                element={<ExperimentRunner isPreview={true} />}
              />
              <Route path="/experiment/:slug" element={<ExperimentRunner />} />
              <Route path="/clinical/:slug" element={<SubjectRunner />} />
              <Route path="/reproduce" element={<ReproducerPage />} />
            </Routes>
          </Suspense>
        </JamProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    performance.mark('app-init-end');
    performance.measure('app-bootstrap', 'app-init-start', 'app-init-end');
    const measure = performance.getEntriesByName('app-bootstrap')[0];
    if (measure) {
      console.log(
        `[Performance] Bootstrapped App in ${measure.duration.toFixed(2)}ms`,
      );
    }
  });
}

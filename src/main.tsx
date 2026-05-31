import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from '@/pages/App';
import GalleryPage from '@/gallery/GalleryPage';
import RecordingPage from '@/pages/RecordingPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import FeedPage from '@/pages/FeedPage';
import { TermsPage, PrivacyPage } from '@/pages/LegalPages';
import { AuthProvider } from '@/auth/AuthProvider';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import MidiSettingsPage from '@/midi/components/MidiSettingsPage';
import PiecePage from '@/pages/PiecePage';
import ListeningSessionPage from '@/pages/ListeningSessionPage';
import MeditationTimerPage from '@/pages/MeditationTimerPage';
import SessionHistoryPage from '@/history/SessionHistoryPage';
import LibraryPage from '@/library/LibraryPage';
import { ExperimentRunner } from '@/experiment/ExperimentRunner';
import { SubjectRunner } from '@/clinical/SubjectRunner';
import ReproducerPage from '@/studies/export/ReproducerPage';
import '@/styles/index.css';
import { BridgeServer } from '@/research/bridge/BridgeServer';

if (typeof window !== 'undefined') {
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
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/p/:slug" element={<App />} />
            <Route path="/jam/:id" element={<App />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/midi" element={<MidiSettingsPage />} />
            <Route path="/piece" element={<PiecePage />} />
            <Route path="/piece/:slug" element={<PiecePage />} />
            <Route path="/listening/:slug" element={<ListeningSessionPage />} />
            <Route
              path="/admin"
              element={
                <Suspense fallback={null}>
                  <AdminPage />
                </Suspense>
              }
            />
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
        </JamProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

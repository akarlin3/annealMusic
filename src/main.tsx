import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from '@/pages/App';
import GalleryPage from '@/gallery/GalleryPage';
import RecordingPage from '@/pages/RecordingPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import { TermsPage, PrivacyPage } from '@/pages/LegalPages';
import { AuthProvider } from '@/auth/AuthProvider';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import MidiSettingsPage from '@/midi/components/MidiSettingsPage';
import '@/styles/index.css';

// Lazy load the AdminPage conditionally to tree-shake it out of mobile builds
const AdminPage = import.meta.env.VITE_MOBILE
  ? () => null
  : lazy(() => import('@/admin/AdminPage'));

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <DeepLinkHandler />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/p/:slug" element={<App />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/midi" element={<MidiSettingsPage />} />
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
          <Route path="/u/:account_id" element={<ProfilePage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

const containerStyle = {
  background: '#0c0a09',
  color: '#fef3c7',
  fontFamily: 'Inter, monospace',
};

const cardStyle = {
  background: 'rgba(28, 25, 23, 0.7)',
  border: '1px solid #44403c',
  boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(12px)',
};

export const TermsPage: React.FC = () => {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 font-mono selection:bg-amber-500/30"
      style={containerStyle}
    >
      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest text-stone-500 hover:text-amber-500 transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Sculptor
        </Link>

        <div className="rounded-2xl p-8 md:p-10 space-y-8" style={cardStyle}>
          <div className="flex items-center gap-4 border-b border-stone-800 pb-6">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-widest uppercase text-amber-500">
                Terms of Service
              </h1>
              <p className="text-[9px] uppercase tracking-wider text-stone-500 mt-1">
                Version 1.4 · Last Updated: May 2026
              </p>
            </div>
          </div>

          <div className="space-y-6 text-xs text-stone-300 leading-relaxed font-sans">
            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                1. Acceptance of Terms
              </h2>
              <p>
                Welcome to AnnealMusic. By accessing or using our generative
                meditation sandbox, sculptors, and recording features, you agree
                to comply with and be bound by these Terms of Service. If you do
                not agree, please do not use the application.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                2. Identity & Content Ownership
              </h2>
              <p>
                AnnealMusic operates on an anonymous-first model. Patches,
                captures, and recordings can be created locally without
                registering an account. You retain copyright over all generative
                audio patches, custom sources, and visual captures created in
                AnnealMusic.
              </p>
              <p>
                When you create a public account, you may manually claim your
                guest-device creations. By publishing creations to the public
                gallery, you grant AnnealMusic a non-exclusive, royalty-free
                license to host, stream, and moderate your content.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                3. Fair Use & Node Moderation
              </h2>
              <p>
                You agree not to upload corrupt audio data, override client-side
                file parameters, or publish offensive metadata. Admin moderators
                reserve the right to flag, unlist, or purge content violating
                user security guidelines.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                4. Service Limitations & Liability
              </h2>
              <p>
                AnnealMusic is provided "as is" without warranties of any kind.
                While authenticated accounts support cross-device backup, we are
                not liable for accidental data losses arising from local browser
                cache purges or server downtime.
              </p>
            </section>
          </div>

          <div className="border-t border-stone-800 pt-6 flex items-center justify-between text-[9px] uppercase tracking-widest text-stone-500">
            <span>© 2026 AnnealMusic</span>
            <Link
              to="/legal/privacy"
              className="hover:text-amber-500 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PrivacyPage: React.FC = () => {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 font-mono selection:bg-amber-500/30"
      style={containerStyle}
    >
      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest text-stone-500 hover:text-amber-500 transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Sculptor
        </Link>

        <div className="rounded-2xl p-8 md:p-10 space-y-8" style={cardStyle}>
          <div className="flex items-center gap-4 border-b border-stone-800 pb-6">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-widest uppercase text-amber-500">
                Privacy Policy
              </h1>
              <p className="text-[9px] uppercase tracking-wider text-stone-500 mt-1">
                Version 1.4 · Last Updated: May 2026
              </p>
            </div>
          </div>

          <div className="space-y-6 text-xs text-stone-300 leading-relaxed font-sans">
            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                1. Information We Collect
              </h2>
              <p>
                <strong>Guest Mode:</strong> We store a randomized local
                identifier (guest UUID) to save patches locally. We collect no
                personal data under Guest Mode.
              </p>
              <p>
                <strong>Authenticated Accounts:</strong> If you sign up using a
                Magic Link or OAuth (Google, GitHub), we store your email
                address, display name, and avatar seed.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                2. Cookies & Local Storage
              </h2>
              <p>
                We use standard `localStorage` and native device preferences
                (via Capacitor Preferences) to retain anonymous sculpts locally
                on your device. For signed-in users, we set a highly secure,
                HttpOnly, SameSite=Lax session cookie (`am_session`) to
                authorize cross-device patch and recording synchronization. No
                tracking or marketing cookies are utilized.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                3. Data Sharing & Hosting
              </h2>
              <p>
                Your private sound sculptures and uploads are hosted securely
                and are never shared or sold. Publicly gallery-published
                creations and display names are viewable by all users.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500/90">
                4. Your Rights & Account Deletion
              </h2>
              <p>
                You hold complete control over your identity. You can unclaim
                devices, unlink Google or GitHub logins at any time in Account
                Settings, or execute complete account deletion. Deletion
                permanently erases your credentials, linked session identifiers,
                and user metadata from our systems.
              </p>
            </section>
          </div>

          <div className="border-t border-stone-800 pt-6 flex items-center justify-between text-[9px] uppercase tracking-widest text-stone-500">
            <span>© 2026 AnnealMusic</span>
            <Link
              to="/legal/terms"
              className="hover:text-amber-500 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

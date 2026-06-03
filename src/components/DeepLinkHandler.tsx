import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { platform } from '@/platform';

export default function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (platform.getPlatform() === 'web') return;

    let isActive = true;
    let removeListener: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const handler = await App.addListener('appUrlOpen', (data) => {
          if (!isActive) return;
          try {
            const parsed = new URL(data.url);
            let path = parsed.pathname;

            // Handle custom scheme URLs where the domain might be parsed as the host name
            if (parsed.protocol === 'org.averykarlin.anneal:') {
              if (
                parsed.host &&
                parsed.host !== 'anneal.averykarlin.org' &&
                parsed.host !== 'localhost'
              ) {
                path = '/' + parsed.host + parsed.pathname;
              }
            }

            const relativePath = path + parsed.search + parsed.hash;

            if (path.startsWith('/embed')) {
              console.warn('Embed routes are ignored on mobile.');
              return;
            }

            // Navigate using client-side router to keep within the SPA wrapper on Capacitor/mobile
            navigate(relativePath);
          } catch (e) {
            console.error('Failed to parse deep link URL:', e);
          }
        });

        removeListener = () => {
          handler.remove();
        };
      } catch (err) {
        console.error('Failed to register appUrlOpen listener:', err);
      }
    };

    void setupListener();

    return () => {
      isActive = false;
      if (removeListener) removeListener();
    };
  }, [navigate]);

  return null;
}

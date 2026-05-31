import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { doc } from './crdt';
import { reportError } from '@/observability/errorReporter';

export interface TransportState {
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
  mode: 'webrtc' | 'websocket' | 'none';
}

let webrtcProvider: WebrtcProvider | null = null;
let websocketProvider: WebsocketProvider | null = null;
let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

export function connectSession(
  sessionId: string,
  wsUrl: string,
  onStateChange: (state: TransportState) => void,
) {
  // Clear any pre-existing connection instances
  disconnectSession();

  console.log('[Jam] Initiating session transport, Room ID:', sessionId);
  onStateChange({ status: 'connecting', mode: 'webrtc' });

  try {
    // 1. Configure the primary peer-to-peer WebRTC transport
    webrtcProvider = new WebrtcProvider(sessionId, doc, {
      signaling: ['wss://signaling.yjs.dev'], // Standard public STUN/signaling server
    });

    // 2. Setup the auto-failover WebSocket timer (5 seconds limit)
    fallbackTimeout = setTimeout(() => {
      if (
        !websocketProvider &&
        (!webrtcProvider || webrtcProvider.connected === false)
      ) {
        console.warn(
          '[Jam] WebRTC P2P direct NAT handshake timed out. Falling back to WebSocket relay...',
        );

        try {
          websocketProvider = new WebsocketProvider(wsUrl, sessionId, doc);
          onStateChange({ status: 'connected', mode: 'websocket' });
        } catch (wsErr) {
          console.error('[Jam] Fallback WebSocket relay setup failed:', wsErr);
          void reportError(
            wsErr,
            'jam-fallback-websocket-relay-failed-timeout',
          );
          onStateChange({ status: 'failed', mode: 'none' });
        }
      }
    }, 5000);

    // 3. Register WebRTC peer listeners
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webrtcProvider.on('peers', (event: any) => {
      console.log('[Jam] WebRTC peers change event:', event);
      if (event.webrtcPeers.length > 0) {
        console.log(
          '[Jam] WebRTC Direct P2P connection successfully established.',
        );

        // Clear WebSocket fallback as Webrtc is active
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
        if (websocketProvider) {
          websocketProvider.disconnect();
          websocketProvider = null;
        }
        onStateChange({ status: 'connected', mode: 'webrtc' });
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webrtcProvider.on('status', (event: any) => {
      console.log('[Jam] WebRTC provider status:', event);
      if (event.connected) {
        onStateChange({ status: 'connected', mode: 'webrtc' });
      }
    });
  } catch (webrtcErr) {
    console.error(
      '[Jam] WebRTC initialization failed. Immediate fallback to WebSocket relay:',
      webrtcErr,
    );
    void reportError(webrtcErr, 'jam-webrtc-initialization-failed');
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      fallbackTimeout = null;
    }

    try {
      websocketProvider = new WebsocketProvider(wsUrl, sessionId, doc);
      onStateChange({ status: 'connected', mode: 'websocket' });
    } catch (wsErr) {
      console.error('[Jam] Fallback WebSocket relay setup failed:', wsErr);
      void reportError(wsErr, 'jam-fallback-websocket-relay-failed');
      onStateChange({ status: 'failed', mode: 'none' });
    }
  }
}

export function disconnectSession() {
  console.log('[Jam] Disconnecting active session transport providers.');

  if (fallbackTimeout) {
    clearTimeout(fallbackTimeout);
    fallbackTimeout = null;
  }

  if (webrtcProvider) {
    try {
      webrtcProvider.disconnect();
    } catch (e) {
      console.warn('[Jam] Error disconnecting WebrtcProvider:', e);
    }
    webrtcProvider = null;
  }

  if (websocketProvider) {
    try {
      websocketProvider.disconnect();
    } catch (e) {
      console.warn('[Jam] Error disconnecting WebsocketProvider:', e);
    }
    websocketProvider = null;
  }
}
export function getActiveProviders() {
  return { webrtcProvider, websocketProvider };
}

import { create } from 'zustand';
import { PolarH10Adapter } from './adapters/polar-h10';
import { PolarVerityAdapter } from './adapters/polar-verity';
import { OpenBCICytonAdapter } from './adapters/openbci-cyton';
import { MuseAdapter } from './adapters/muse';
import { EmpaticaAdapter } from './adapters/empatica';
import { BiosignalAdapter, BiosignalFrame, Subscription } from './types';

export interface ConnectedDevice {
  adapter: BiosignalAdapter;
  connection: unknown;
  subscription: Subscription | null;
  latestFrame: BiosignalFrame | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  errorMsg?: string;
}

interface BiofeedbackStore {
  adapters: BiosignalAdapter[];
  connectedDevices: Record<string, ConnectedDevice>;
  isScanning: boolean;

  registerAdapter: (adapter: BiosignalAdapter) => void;
  connectDevice: (
    adapterId: string,
    transport: 'webserial' | 'webbluetooth' | 'webhid' | 'osc',
  ) => Promise<void>;
  disconnectDevice: (adapterId: string) => Promise<void>;
  setScanning: (scanning: boolean) => void;
  updateLatestFrame: (adapterId: string, frame: BiosignalFrame) => void;
}

export const useBiofeedbackStore = create<BiofeedbackStore>((set, get) => ({
  adapters: [
    new PolarH10Adapter(),
    new PolarVerityAdapter(),
    new OpenBCICytonAdapter(),
    new MuseAdapter(),
    new EmpaticaAdapter(),
  ],
  connectedDevices: {},
  isScanning: false,

  registerAdapter: (adapter) => {
    set((state) => {
      if (state.adapters.some((a) => a.id === adapter.id)) {
        return state;
      }
      return { adapters: [...state.adapters, adapter] };
    });
  },

  setScanning: (scanning) => set({ isScanning: scanning }),

  connectDevice: async (adapterId, transport) => {
    const adapter = get().adapters.find((a) => a.id === adapterId);
    if (!adapter) {
      throw new Error(`Adapter ${adapterId} not found`);
    }

    set((state) => ({
      connectedDevices: {
        ...state.connectedDevices,
        [adapterId]: {
          adapter,
          connection: null,
          subscription: null,
          latestFrame: null,
          status: 'connecting',
        },
      },
    }));

    try {
      const connection = await adapter.connect(transport);

      const subscription = adapter.stream(connection).subscribe({
        next: (frame) => {
          get().updateLatestFrame(adapterId, frame);
        },
        error: (err) => {
          console.error(`Stream error in adapter ${adapterId}:`, err);
          set((state) => ({
            connectedDevices: {
              ...state.connectedDevices,
              [adapterId]: {
                ...state.connectedDevices[adapterId]!,
                status: 'error',
                errorMsg: String(err),
              },
            },
          }));
        },
      });

      set((state) => ({
        connectedDevices: {
          ...state.connectedDevices,
          [adapterId]: {
            ...state.connectedDevices[adapterId]!,
            connection,
            subscription,
            status: 'connected',
          },
        },
      }));
    } catch (err) {
      console.error(`Failed to connect adapter ${adapterId}:`, err);
      set((state) => ({
        connectedDevices: {
          ...state.connectedDevices,
          [adapterId]: {
            adapter,
            connection: null,
            subscription: null,
            latestFrame: null,
            status: 'error',
            errorMsg: String(err),
          },
        },
      }));
      throw err;
    }
  },

  disconnectDevice: async (adapterId) => {
    const dev = get().connectedDevices[adapterId];
    if (!dev) return;

    if (dev.subscription) {
      dev.subscription.unsubscribe();
    }

    try {
      await dev.adapter.disconnect(dev.connection);
    } catch (err) {
      console.error(`Error disconnecting adapter ${adapterId}:`, err);
    }

    set((state) => {
      const nextConnected = { ...state.connectedDevices };
      delete nextConnected[adapterId];
      return { connectedDevices: nextConnected };
    });
  },

  updateLatestFrame: (adapterId, frame) => {
    set((state) => {
      const dev = state.connectedDevices[adapterId];
      if (!dev) return state;

      return {
        connectedDevices: {
          ...state.connectedDevices,
          [adapterId]: {
            ...dev,
            latestFrame: frame,
          },
        },
      };
    });
  },
}));

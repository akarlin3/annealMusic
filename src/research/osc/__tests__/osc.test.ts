/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OSCNamespace } from '../OSCNamespace';
import { OSCFilter } from '../OSCFilter';
import { OSCBridge } from '../OSCBridge';

describe('OSC Module Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('OSCNamespace Mapper', () => {
    it('serializes state params to OSC state addresses correctly', () => {
      const messages = OSCNamespace.stateToOsc('params', {
        rootFreq: 220,
        brightness: 0.7,
      });

      expect(messages).toHaveLength(2);
      expect(messages).toContainEqual({
        address: '/anneal/state/rootFreq',
        args: [220],
      });
      expect(messages).toContainEqual({
        address: '/anneal/state/brightness',
        args: [0.7],
      });
    });

    it('serializes engine switches and modes', () => {
      const engineMsg = OSCNamespace.stateToOsc('engineId', 'granular');
      expect(engineMsg).toEqual([
        { address: '/anneal/state/engine', args: ['granular'] },
      ]);

      const modeMsg = OSCNamespace.stateToOsc('mode', 'drone');
      expect(modeMsg).toEqual([
        { address: '/anneal/state/mode', args: ['drone'] },
      ]);
    });

    it('parses control OSC actions to correct mutations', () => {
      const paramMsg = { address: '/anneal/control/rootFreq', args: [150.0] };
      const parsedParam = OSCNamespace.oscToControl(paramMsg);
      expect(parsedParam).toEqual({
        type: 'param',
        key: 'rootFreq',
        value: 150.0,
      });

      const engineMsg = {
        address: '/anneal/control/engine',
        args: ['waveguide'],
      };
      const parsedEngine = OSCNamespace.oscToControl(engineMsg);
      expect(parsedEngine).toEqual({
        type: 'engine',
        value: 'waveguide',
      });

      const sessionStartMsg = {
        address: '/anneal/control/session/start',
        args: [],
      };
      const parsedSession = OSCNamespace.oscToControl(sessionStartMsg);
      expect(parsedSession).toEqual({
        type: 'session',
        action: 'start',
      });
    });
  });

  describe('OSCFilter Rate Limiting & Whitelist', () => {
    it('initializes default rules and persists to localStorage', () => {
      const filter = new OSCFilter();
      const rules = filter.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(filter.getRule('/anneal/state/root').enabled).toBe(true);
      expect(filter.getRule('/anneal/spectrum').throttleMs).toBe(33);

      expect(localStorage.getItem('anneal_osc_filter_rules')).toBeDefined();
    });

    it('throttles high-frequency packets and passes standard ones', () => {
      const filter = new OSCFilter();

      // Let's test /anneal/spectrum with 33ms throttle
      filter.updateRule('/anneal/spectrum', { enabled: true, throttleMs: 33 });

      // First call should pass
      expect(filter.shouldPass('/anneal/spectrum')).toBe(true);

      // Call 10ms later should be throttled
      vi.advanceTimersByTime(10);
      expect(filter.shouldPass('/anneal/spectrum')).toBe(false);

      // Call 35ms later (total 45ms since first) should pass
      vi.advanceTimersByTime(25);
      expect(filter.shouldPass('/anneal/spectrum')).toBe(true);
    });

    it('blocks disabled addresses completely', () => {
      const filter = new OSCFilter();
      filter.updateRule('/anneal/state/root', { enabled: false });

      expect(filter.shouldPass('/anneal/state/root')).toBe(false);
    });
  });

  describe('OSCBridge Interface Controller', () => {
    let mockClient: any;
    let mockWebSocket: any;

    beforeEach(() => {
      mockClient = {
        setState: vi.fn().mockResolvedValue(true),
        setEngine: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue('sub-123'),
        unsubscribe: vi.fn().mockResolvedValue(true),
        getSessionStatus: vi
          .fn()
          .mockResolvedValue({ status: 'playing', elapsedMs: 15000 }),
        getSpectrum: vi.fn().mockResolvedValue({ spectrum: [1, 2, 3] }),
        getPartials: vi
          .fn()
          .mockResolvedValue({ partials: [{ freq: 110, amp: 0.5 }] }),
      };

      // Mock WebSocket
      mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      };

      const mockWSConstructor = vi.fn().mockImplementation(() => mockWebSocket);
      (mockWSConstructor as any).OPEN = 1;
      vi.stubGlobal('WebSocket', mockWSConstructor);
    });

    it('connects to local helper and sets state callbacks', async () => {
      const bridge = new OSCBridge(mockClient);

      const connectPromise = bridge.connect({ wsPort: 8766 });

      // Trigger open callback
      mockWebSocket.onopen();

      await connectPromise;

      expect(bridge.getStatus()).toBe('connected');
      expect(mockClient.subscribe).toHaveBeenCalled();
    });

    it('sends data and registers outgoing logs', async () => {
      const bridge = new OSCBridge(mockClient);
      await bridge.connect();
      mockWebSocket.onopen();

      bridge.filter.updateRule('/anneal/state/root', {
        enabled: true,
        throttleMs: 0,
      });
      await bridge.send('/anneal/state/root', [110.0]);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const payload = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(payload).toEqual({
        address: '/anneal/state/root',
        args: [110.0],
      });

      expect(bridge.getLogs()).toHaveLength(1);
      expect(bridge.getLogs()[0]!.direction).toBe('out');
      expect(bridge.getLogs()[0]!.address).toBe('/anneal/state/root');
    });

    it('processes incoming events to trigger mutations', async () => {
      const bridge = new OSCBridge(mockClient);
      await bridge.connect();
      mockWebSocket.onopen();

      // Simulate incoming OSC WebSocket message
      const incomingFrame = JSON.stringify({
        address: '/anneal/control/brightness',
        args: [0.85],
      });
      mockWebSocket.onmessage({ data: incomingFrame });

      expect(mockClient.setState).toHaveBeenCalledWith({ brightness: 0.85 });
      expect(bridge.getLogs()[0]!.direction).toBe('in');
      expect(bridge.getLogs()[0]!.args).toEqual([0.85]);
    });
  });
});

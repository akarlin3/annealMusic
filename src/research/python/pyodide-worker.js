/* eslint-disable no-restricted-globals */

// Load Pyodide from official stable CDN
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/pyodide.js');

let pyodide = null;
let _py_initialized = false;

// Worker Local Cache
let cachedState = {
  params: {},
  engineId: 'sine',
  engineParams: {},
  tuning: {},
  mode: 'sketch',
};
let cachedSpectrum = [];
let cachedPartials = [];
let localTicks = [];
const MAX_TICKS = 1000;
let pendingRequests = new Map();
let nextId = 10000;

// Connect BroadcastChannel for state sync + bridge execution
const bridgeChannel = new BroadcastChannel('anneal_music_bridge');

// Send RPC call to main thread BridgeServer
function callBridge(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    bridgeChannel.postMessage({
      jsonrpc: '2.0',
      method,
      params,
      id,
    });
  });
}

// Global bridge helper exposed to Python via JS interop
self._anneal_bridge = {
  getState: () => {
    return cachedState;
  },
  setState: (params) => {
    callBridge('anneal.state.set', { params });
  },
  setEngine: (engineId) => {
    callBridge('anneal.state.setEngine', { engineId });
  },
  getSpectrum: () => {
    return cachedSpectrum;
  },
  getPartials: () => {
    return cachedPartials;
  },
  subscribe: (keys) => {
    callBridge('anneal.state.subscribe', { keys });
    return 'py_worker_sub';
  },
  unsubscribe: (subId) => {
    // No-op
  },
  startSession: () => {
    callBridge('anneal.session.start');
  },
  stopSession: () => {
    callBridge('anneal.session.stop');
  },
  datalogStart: (mode) => {
    callBridge('anneal.datalog.start', { mode });
  },
  datalogSnapshot: () => {
    return localTicks;
  },
  datalogStop: () => {
    callBridge('anneal.datalog.stop');
  },
  version: () => {
    return '5.4.0';
  },
};

// Listen to BroadcastChannel messages (sync updates from BridgeServer)
bridgeChannel.onmessage = (event) => {
  const msg = event.data;
  if (!msg) return;

  // 1. Resolve pending request
  if (msg.id !== undefined && pendingRequests.has(msg.id)) {
    const pending = pendingRequests.get(msg.id);
    pendingRequests.delete(msg.id);
    if (msg.error) {
      pending.reject(new Error(msg.error.message));
    } else {
      pending.resolve(msg.result);
    }
  }
  // 2. State updates from parameters store
  else if (msg.method === 'anneal.state.onChange') {
    const { key, value } = msg.params;
    if (key === 'params') {
      cachedState.params = { ...cachedState.params, ...value };
    } else if (key === 'engineId') {
      cachedState.engineId = value;
    } else if (key === 'engineParams') {
      cachedState.engineParams = { ...cachedState.engineParams, ...value };
    } else if (key === 'tuning') {
      cachedState.tuning = value;
    } else if (key === 'mode') {
      cachedState.mode = value;
    }

    // Call python subscription watchers
    if (_py_initialized && pyodide) {
      try {
        pyodide.globals.get('_on_change_trigger')(key, value);
      } catch (err) {
        // Ignore trigger errors
      }
    }
  }
  // 3. Tick updates from datalogger stream
  else if (msg.method === 'anneal.datalog.onTick') {
    const { tick } = msg.params;
    localTicks.push(tick);
    if (localTicks.length > MAX_TICKS) {
      localTicks.shift();
    }
  }
};

// Web Worker postMessage handler (interface from UI thread)
self.onmessage = async (event) => {
  const { type, code, moduleCode } = event.data;

  if (type === 'init') {
    try {
      postMessage({ type: 'status', stage: 'loading', progress: 0.1 });

      // Cold boot Pyodide
      pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });
      postMessage({ type: 'status', stage: 'loading', progress: 0.5 });

      // Load bundled packages
      await pyodide.loadPackage('numpy');
      postMessage({ type: 'status', stage: 'loading', progress: 0.8 });

      // Build custom `anneal` module
      await pyodide.runPythonAsync(moduleCode);

      // Monkeypatch Python networking to enforce sandbox
      await pyodide.runPythonAsync(`
import sys

# Overwrite pyfetch to block arbitrary network egress
try:
    import pyodide.http
    def blocked_fetch(*args, **kwargs):
        raise PermissionError("Network access is disabled in the script sandbox.")
    pyodide.http.pyfetch = blocked_fetch
    
    import pyodide_js.http
    pyodide_js.http.pyfetch = blocked_fetch
except Exception:
    pass

# Overwrite socket to block socket-level egress
try:
    import socket
    def blocked_socket(*args, **kwargs):
        raise PermissionError("Socket access is disabled in the script sandbox.")
    socket.socket = blocked_socket
    socket.getaddrinfo = blocked_socket
except Exception:
    pass

# Overwrite urllib to block HTTP library egress
try:
    import urllib.request
    urllib.request.urlopen = blocked_socket
except Exception:
    pass
      `);

      _py_initialized = true;

      // Subscribe worker to live parameters store changes
      callBridge('anneal.state.subscribe', {
        keys: ['params', 'engineId', 'tuning', 'mode', 'engineParams'],
      });
      // Subscribe worker to live datalogger tick streaming
      callBridge('anneal.datalog.stream');

      postMessage({ type: 'status', stage: 'ready' });
    } catch (err) {
      postMessage({ type: 'status', stage: 'error', error: err.message });
    }
  } else if (type === 'run') {
    if (!_py_initialized) {
      postMessage({
        type: 'stderr',
        text: 'Python interpreter not initialized.\n',
      });
      postMessage({ type: 'run-complete', success: false });
      return;
    }

    try {
      // Redirect outputs
      pyodide.setStdout({
        batched: (str) => {
          postMessage({ type: 'stdout', text: str + '\n' });
        },
      });
      pyodide.setStderr({
        batched: (str) => {
          postMessage({ type: 'stderr', text: str + '\n' });
        },
      });

      await pyodide.runPythonAsync(code);
      postMessage({ type: 'run-complete', success: true });
    } catch (err) {
      postMessage({ type: 'stderr', text: err.message + '\n' });
      postMessage({ type: 'run-complete', success: false });
    }
  } else if (type === 'repl') {
    if (!_py_initialized) {
      postMessage({
        type: 'repl-complete',
        success: false,
        error: 'Python interpreter not initialized.',
      });
      return;
    }

    try {
      pyodide.setStdout({
        batched: (str) => {
          postMessage({ type: 'stdout', text: str + '\n' });
        },
      });
      pyodide.setStderr({
        batched: (str) => {
          postMessage({ type: 'stderr', text: str + '\n' });
        },
      });

      const result = await pyodide.runPythonAsync(code);
      let resText = '';
      if (result !== undefined && result !== null) {
        resText = String(result);
      }
      postMessage({ type: 'repl-complete', success: true, result: resText });
    } catch (err) {
      postMessage({
        type: 'repl-complete',
        success: false,
        error: err.message,
      });
    }
  } else if (type === 'cache-update') {
    const { params, engineId, engineParams, tuning, mode } = event.data;
    if (params) cachedState.params = { ...cachedState.params, ...params };
    if (engineId) cachedState.engineId = engineId;
    if (engineParams)
      cachedState.engineParams = {
        ...cachedState.engineParams,
        ...engineParams,
      };
    if (tuning) cachedState.tuning = tuning;
    if (mode) cachedState.mode = mode;
  } else if (type === 'fft-update') {
    const { spectrum, partials } = event.data;
    if (spectrum) cachedSpectrum = spectrum;
    if (partials) cachedPartials = partials;
  }
};

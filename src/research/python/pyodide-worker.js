/* eslint-disable no-restricted-globals */

// Load Pyodide from official stable CDN
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/pyodide.js');

let pyodide = null;
let _py_initialized = false;
let _scientific_env_loaded = false;

// Curated Scientific Python Whitelist Guard
const ALLOWED_MODULES = new Set([
  // Whitelisted Scientific Packages
  'numpy',
  'scipy',
  'matplotlib',
  'pandas',
  'sklearn',
  'pyarrow',
  // Standard built-in modules & system utilities
  'anneal',
  'sys',
  'types',
  'uuid',
  'math',
  'time',
  'io',
  'json',
  'asyncio',
  'itertools',
  'builtins',
  'os',
  'collections',
  'functools',
  're',
  'warnings',
  'datetime',
  'random',
  'copy',
  'abc',
  'traceback',
  'weakref',
  'operator',
  'inspect',
  'typing',
]);

function detectImports(code) {
  const imports = new Set();
  const lines = code.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('import ')) {
      const content = line.substring(7);
      const parts = content.split(',');
      for (const p of parts) {
        const word = p.trim().split(/\s+/)[0];
        const root = word.split('.')[0];
        if (root) imports.add(root);
      }
    } else if (line.startsWith('from ')) {
      const match = line.match(/^from\s+([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        imports.add(match[1]);
      }
    }
  }
  return Array.from(imports);
}

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
  renderPlot: (imgBytes) => {
    const bytes = imgBytes.to_py ? imgBytes.to_py() : imgBytes;
    postMessage({ type: 'plot-render', bytes });
  },
  render: async (duration, format) => {
    return await callBridge('anneal.session.render', { duration, format });
  },
  registerExperiment: (expDef) => {
    const experiment = expDef.to_py ? expDef.to_py() : expDef;
    postMessage({ type: 'experiment-registered', experiment });
  },
  version: () => {
    return '5.5.0';
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

async function enforceWhitelistAndAutoLoad(code) {
  const imports = detectImports(code);

  // 1. Guard against non-whitelisted packages
  for (const imp of imports) {
    if (!ALLOWED_MODULES.has(imp)) {
      throw new Error(
        `ImportError: Package '${imp}' is not in the approved Scientific Python Whitelist.`,
      );
    }
  }

  // 2. Identify scientific packages to load
  const scientificImports = imports.filter((imp) =>
    ['scipy', 'pandas', 'matplotlib', 'sklearn'].includes(imp),
  );
  if (scientificImports.length > 0 && !_scientific_env_loaded) {
    postMessage({ type: 'status', stage: 'loading', progress: 0.2 });
    postMessage({
      type: 'stdout',
      text: `\n[Auto-loading whitelisted packages: ${scientificImports.join(', ')} from CDN...] ⏳\n`,
    });

    // Lazy load micropip first
    await pyodide.loadPackage('micropip');
    const micropip = pyodide.pyimport('micropip');

    const packageMap = {
      scipy: 'scipy',
      pandas: 'pandas',
      matplotlib: 'matplotlib',
      sklearn: 'scikit-learn',
    };

    const toLoad = scientificImports.map((imp) => packageMap[imp]);
    await micropip.install(toLoad);

    _scientific_env_loaded = true;
    postMessage({
      type: 'stdout',
      text: `[Scientific environment loaded successfully!] ✅\n\n`,
    });
    postMessage({ type: 'status', stage: 'ready' });
  }
}

// Web Worker postMessage handler (interface from UI thread)
self.onmessage = async (event) => {
  const { type, code, moduleCode, preloadScientific } = event.data;

  if (type === 'init') {
    try {
      postMessage({ type: 'status', stage: 'loading', progress: 0.1 });

      // Cold boot Pyodide
      pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });
      postMessage({ type: 'status', stage: 'loading', progress: 0.4 });

      // Load bundled packages (NumPy by default)
      await pyodide.loadPackage('numpy');

      // Preload full scientific suite if requested
      if (preloadScientific) {
        postMessage({ type: 'status', stage: 'loading', progress: 0.6 });
        await pyodide.loadPackage('micropip');
        const micropip = pyodide.pyimport('micropip');
        await micropip.install([
          'scipy',
          'pandas',
          'matplotlib',
          'scikit-learn',
        ]);
        _scientific_env_loaded = true;
      }

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

      // Whitelist check & dynamic loader pre-run
      await enforceWhitelistAndAutoLoad(code);

      if (_scientific_env_loaded) {
        await pyodide.runPythonAsync(`
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
    def _custom_show(*args, **kwargs):
        import io
        from js import _anneal_bridge
        fig = plt.gcf()
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        img_bytes = list(buf.read())
        _anneal_bridge.renderPlot(img_bytes)
        plt.close(fig)
        
    plt.show = _custom_show
except Exception:
    pass
        `);
      }

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

      // Whitelist check & dynamic loader pre-run
      await enforceWhitelistAndAutoLoad(code);

      if (_scientific_env_loaded) {
        await pyodide.runPythonAsync(`
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    
    def _custom_show(*args, **kwargs):
        import io
        from js import _anneal_bridge
        fig = plt.gcf()
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        img_bytes = list(buf.read())
        _anneal_bridge.renderPlot(img_bytes)
        plt.close(fig)
        
    plt.show = _custom_show
except Exception:
    pass
        `);
      }

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
  } else if (type === 'vfs-list') {
    try {
      try {
        pyodide.FS.mkdir('/tmp');
      } catch (e) {
        // Ignored if directory already exists
      }
      const files = pyodide.FS.readdir('/tmp');
      const list = [];
      for (const name of files) {
        if (name === '.' || name === '..') continue;
        const path = `/tmp/${name}`;
        const stat = pyodide.FS.stat(path);
        list.push({
          name,
          path,
          sizeBytes: stat.size,
          mtime: stat.mtime,
        });
      }
      postMessage({ type: 'vfs-list-response', success: true, files: list });
    } catch (err) {
      postMessage({
        type: 'vfs-list-response',
        success: false,
        error: err.message,
      });
    }
  } else if (type === 'vfs-read') {
    try {
      const { path } = event.data;
      const bytes = pyodide.FS.readFile(path, { encoding: 'binary' });
      postMessage({ type: 'vfs-read-response', success: true, path, bytes }, [
        bytes.buffer,
      ]);
    } catch (err) {
      postMessage({
        type: 'vfs-read-response',
        success: false,
        path: event.data.path,
        error: err.message,
      });
    }
  } else if (type === 'vfs-delete') {
    try {
      const { path } = event.data;
      pyodide.FS.unlink(path);
      postMessage({ type: 'vfs-delete-response', success: true, path });
    } catch (err) {
      postMessage({
        type: 'vfs-delete-response',
        success: false,
        path: event.data.path,
        error: err.message,
      });
    }
  }
};

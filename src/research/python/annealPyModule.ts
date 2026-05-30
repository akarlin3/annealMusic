export const ANNEAL_PY_MODULE = `
import sys
import types
import numpy as np
from js import _anneal_bridge

# Create the module
anneal = types.ModuleType("anneal")
sys.modules["anneal"] = anneal

# Nested sub-modules
state = types.ModuleType("state")
anneal.state = state

engine = types.ModuleType("engine")
anneal.engine = engine

session = types.ModuleType("session")
anneal.session = session

datalog = types.ModuleType("datalog")
anneal.datalog = datalog

# Subscriptions map: sub_id -> (keys_list, callback)
_callbacks = {}
import uuid

def _on_change_trigger(key, value):
    py_value = value.to_py() if hasattr(value, "to_py") else value
    for sub_id, (keys, callback) in list(_callbacks.items()):
        if key == 'params' and isinstance(py_value, dict):
            diff = {k: py_value[k] for k in keys if k in py_value}
            if diff:
                try:
                    callback(diff)
                except Exception as e:
                    print("Error watch callback:", e)
        elif key in keys:
            try:
                callback({key: py_value})
            except Exception as e:
                print("Error watch callback:", e)

# Register trigger globally so JS can invoke it
sys.modules["__main__"]._on_change_trigger = _on_change_trigger

# Define anneal.state APIs
def state_get():
    return _anneal_bridge.getState().to_py()

def state_set(params):
    import pyodide
    js_params = pyodide.ffi.to_js(params)
    _anneal_bridge.setState(js_params)

def state_set_engine(engine_id):
    _anneal_bridge.setEngine(engine_id)

def state_subscribe(keys, callback):
    import pyodide
    sub_id = "sub_" + str(uuid.uuid4())
    _callbacks[sub_id] = (keys, callback)
    # Notify JS of watch subscription to bridge
    _anneal_bridge.subscribe(pyodide.ffi.to_js(keys))
    return sub_id

def state_unsubscribe(sub_id):
    if sub_id in _callbacks:
        del _callbacks[sub_id]
        # In simple JS, no-op is fine since Python filters callbacks

state.get = state_get
state.set = state_set
state.set_engine = state_set_engine
state.subscribe = state_subscribe
state.unsubscribe = state_unsubscribe


# Define anneal.engine APIs
def engine_get_spectrum():
    js_arr = _anneal_bridge.getSpectrum()
    return np.array(js_arr.to_py())

def engine_get_partials():
    return _anneal_bridge.getPartials().to_py()

engine.get_spectrum = engine_get_spectrum
engine.get_partials = engine_get_partials


# Define anneal.session APIs
def session_start():
    _anneal_bridge.startSession()

def session_stop():
    _anneal_bridge.stopSession()

session.start = session_start
session.stop = session_stop


# Define anneal.datalog APIs
def datalog_start(mode="standard"):
    _anneal_bridge.datalogStart(mode)

def datalog_snapshot():
    ticks = _anneal_bridge.datalogSnapshot().to_py()
    if not ticks:
        return np.array([])
    return np.array(ticks)

def datalog_stop():
    _anneal_bridge.datalogStop()

datalog.start = datalog_start
datalog.snapshot = datalog_snapshot
datalog.stop = datalog_stop


# Define anneal.version API
def version():
    return _anneal_bridge.version()

anneal.version = version


# Define extended scientific APIs
def session_log(last_seconds=None, format='standard'):
    import pandas as pd
    ticks = _anneal_bridge.datalogSnapshot().to_py()
    if not ticks:
        return pd.DataFrame()
    if last_seconds is not None:
        max_t = ticks[-1]['timestamp']
        ticks = [t for t in ticks if t['timestamp'] >= max_t - last_seconds]
    df = pd.json_normalize(ticks)
    if format == 'spectrum':
        cols = [c for c in df.columns if c.startswith('features.spectrum') or c in ['timestamp', 'wallTime', 'event']]
        if cols:
            return df[cols]
    return df

async def stream_log(every_n_ticks=10):
    import asyncio
    import pandas as pd
    last_idx = len(_anneal_bridge.datalogSnapshot().to_py())
    while True:
        await asyncio.sleep(0.1)
        ticks = _anneal_bridge.datalogSnapshot().to_py()
        curr_len = len(ticks)
        if curr_len >= last_idx + every_n_ticks:
            batch = ticks[last_idx:curr_len]
            last_idx = curr_len
            yield pd.json_normalize(batch)

async def sweep(params_grid, duration=5):
    import itertools
    import asyncio
    import pandas as pd
    import numpy as np
    
    keys = list(params_grid.keys())
    values = list(params_grid.values())
    combinations = list(itertools.product(*values))
    
    results = []
    
    for combo in combinations:
        patch = {keys[i]: combo[i] for i in range(len(keys))}
        state_set(patch)
        await asyncio.sleep(0.1)
        start_ticks = len(_anneal_bridge.datalogSnapshot().to_py())
        
        await asyncio.sleep(duration)
        
        all_ticks = _anneal_bridge.datalogSnapshot().to_py()
        interval = all_ticks[start_ticks:]
        
        row = {**patch}
        if interval:
            rms_vals = [t['features']['rms'] for t in interval if 'features' in t]
            centroid_vals = [t['features']['spectralCentroid'] for t in interval if 'features' in t]
            flux_vals = [t['features']['spectralFlux'] for t in interval if 'features' in t]
            zcr_vals = [t['features']['zcr'] for t in interval if 'features' in t]
            order_param_vals = [t['drift']['orderParameter'] for t in interval if 'drift' in t]
            
            row['rms_mean'] = np.mean(rms_vals) if rms_vals else 0.0
            row['rms_max'] = np.max(rms_vals) if rms_vals else 0.0
            row['spectral_centroid_mean'] = np.mean(centroid_vals) if centroid_vals else 0.0
            row['spectral_flux_mean'] = np.mean(flux_vals) if flux_vals else 0.0
            row['zcr_mean'] = np.mean(zcr_vals) if zcr_vals else 0.0
            row['order_parameter_mean'] = np.mean(order_param_vals) if order_param_vals else 0.0
        else:
            row['rms_mean'] = row['rms_max'] = row['spectral_centroid_mean'] = 0.0
            row['spectral_flux_mean'] = row['zcr_mean'] = row['order_parameter_mean'] = 0.0
            
        results.append(row)
        
    return pd.DataFrame(results)

def features(start=None, end=None):
    import pandas as pd
    ticks = _anneal_bridge.datalogSnapshot().to_py()
    if not ticks:
        return pd.DataFrame()
    filtered = ticks
    if start is not None:
        filtered = [t for t in filtered if t['timestamp'] >= start]
    if end is not None:
        filtered = [t for t in filtered if t['timestamp'] <= end]
    if not filtered:
        return pd.DataFrame()
    
    feats = []
    for t in filtered:
        f = t.get('features', {})
        row = {
            'timestamp': t['timestamp'],
            'rms': f.get('rms', 0),
            'spectralCentroid': f.get('spectralCentroid', 0),
            'spectralFlux': f.get('spectralFlux', 0),
            'zcr': f.get('zcr', 0)
        }
        feats.append(row)
    return pd.DataFrame(feats)

async def render(duration=30, format='numpy', path=None):
    import numpy as np
    promise = _anneal_bridge.render(duration, format)
    res = await promise
    data = res.to_py()
    
    if format == 'numpy':
        return np.array(data['channels'])
    elif format == 'wav':
        if not path:
            raise ValueError("WAV render requires a destination path")
        bytes_data = bytes(data['bytes'])
        with open(path, 'wb') as f:
            f.write(bytes_data)
        return True

anneal.session_log = session_log
anneal.stream_log = stream_log
anneal.sweep = sweep
anneal.features = features
anneal.render = render
`;

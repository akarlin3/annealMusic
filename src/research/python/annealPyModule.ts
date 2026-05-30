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
`;

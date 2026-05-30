# Composer & Generative Musician Recipes

These recipes focus on generative parameter control, random processes, and external environment mapping for live performances and procedural soundscapes.

---

## Recipe 1: Generate 100 Drone Variations

- **Goal:** Generate 100 distinct generative sound patches by sweeping parameter grids and evaluating their aesthetic properties.
- **Prose Walkthrough:** In the `/research` panel, run a Python loop that constructs combinations of `coupling`, `drift`, and `spread`, applying each set to the synthesis engine and saving a screenshot/log of the parameters.

### Python Implementation:

```python
import anneal
import asyncio
import random

async def generate_variations():
    print("[INFO] Initiating 100 variation sweep...")
    for i in range(100):
        patch = {
            "rootFreq": random.uniform(80.0, 220.0),
            "coupling": random.uniform(0.1, 0.9),
            "drift": random.uniform(0.0, 0.7),
            "brightness": random.uniform(0.3, 0.8),
            "space": random.uniform(0.4, 0.9)
        }
        # Update synth state
        anneal.state.set(patch)
        print(f"[Variation {i+1}] Root: {patch['rootFreq']:.1f}Hz, Coupling: {patch['coupling']:.2f}")
        await asyncio.sleep(0.5) # Allow 500ms for sound transition

# Run the async generator
asyncio.ensure_future(generate_variations())
```

### Expected Telemetry Output:

- **Audio:** 100 evolving ambient textures, shifting from desynchronized modal bells to dense phase-locked string drones.
- **Console:** Lists 100 successfully applied patch maps.

---

## Recipe 2: Brownian Parameter Random Walk

- **Goal:** Create a slow, continuously evolving parameter state that wanders through the synthesizer parameter domain without exceeding pleasant limits.
- **Prose Walkthrough:** Implement brownian walk equations for sliders `coupling`, `brightness`, and `drift` inside an async loop, ensuring boundaries are clamped.

### Python Implementation:

```python
import anneal
import asyncio
import random

async def brownian_walk():
    # Load initial parameters
    state = anneal.state.get()
    params = state['params']

    coupling = params.get('coupling', 0.5)
    brightness = params.get('brightness', 0.5)

    step_size = 0.02

    print("[INFO] Starting Brownian Parameter Walk...")
    while True:
        # Generate random steps (-step_size to +step_size)
        coupling += random.uniform(-step_size, step_size)
        brightness += random.uniform(-step_size, step_size)

        # Clamp values strictly to physics domain
        coupling = max(0.0, min(1.0, coupling))
        brightness = max(0.1, min(0.9, brightness))

        # Update engine
        anneal.state.set({
            "coupling": coupling,
            "brightness": brightness
        })

        await asyncio.sleep(0.1) # 10Hz updates

asyncio.ensure_future(brownian_walk())
```

### Expected Output:

- Continuous slow, organic evolution of timbre without sharp sudden jumps.

---

## Recipe 3: Drive AnnealMusic from SuperCollider

- **Goal:** Direct parameter adjustments from SuperCollider over network UDP.
- **Prose Walkthrough:** Run the localhost OSC WebSocket helper, allocate a target SuperCollider socket port, send `/anneal/control/root` control messages, and establish state callbacks.

### SuperCollider Script:

```supercollider
// 1. Setup Outgoing Controller (Send to Bridge Port 8765)
~anneal = NetAddr("127.0.0.1", 8765);

// Set root frequency of synthesizer (e.g. A3 = 220Hz)
~anneal.sendMsg("/anneal/control/root", 220.0);

// Swap active synthesis engine to Physical Waveguide string
~anneal.sendMsg("/anneal/control/engine", "physical");

// 2. Register Incoming State Watchers (Receive on Port 9000)
thisProcess.openUDPPort(9000);

OSCdef(\rootWatcher, { |msg|
    var currentFreq = msg[1];
    ("AnnealMusic root frequency is now: " + currentFreq + " Hz").postln;
}, '/anneal/state/root');
```

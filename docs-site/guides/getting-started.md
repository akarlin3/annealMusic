# Getting Started with AnnealMusic Research

Welcome to the research documentation for **AnnealMusic**. AnnealMusic bridges the gap between creative sonic exploration and rigorous computational/cognitive science by offering a highly performant, open-source generative audio synthesizer coupled with deep instrumentation interfaces.

---

## The Four Research Surfaces

AnnealMusic provides four distinct surfaces tailored to different research and integration requirements:

```
                  ┌──────────────────────┐
                  │ AnnealMusic Engine   │
                  └──────────┬───────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Python Script   │ │ OSC Namespace   │ │ Command Line    │
│ (Pyodide VFS)   │ │ (UDP Bridge)    │ │ Interface (CLI) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

1. **Python via Pyodide:** Run in-browser scientific scripts directly in `/research`, accessing libraries like Numpy, Pandas, and Scikit-learn with zero local environment setup.
2. **Open Sound Control (OSC):** Stream interactive telemetry or trigger real-time parameter changes via UDP from SuperCollider, TouchOSC, Eurorack converters, and other audio controllers.
3. **Command Line Interface (CLI):** A Node-based executable for batch rendering sweeps offline, stems splitting, and running validations.
4. **JSON-RPC Bridge:** A transport-agnostic, standardized message protocol enabling custom integrations over local socket tunnels or broadcast channels.

---

## Finding Your Persona Quickstart

### Generative Musicians & Composers

Create complex parameter sweeps, map brownian walks over oscillator domains, or map external physical widgets (TouchOSC/SuperCollider) to synthesize evolving soundscapes.

- 👉 Jump to [Composer Recipes](/recipes/composer)
- 👉 Check the [OSC Reference](/reference/osc)

### Music Cognition Researchers

Design and deploy web-sandboxed perceptual experiments measuring consonant and dissonant thresholds, forced choices, or continuous valence sliders, complying with strict zero-tracking IRB rules.

- 👉 Jump to [Cognition Recipes](/recipes/cognition)
- 👉 Check the [Experiment Runner Reference](/reference/experiment)

### Music Information Retrieval (MIR) & ML Engineers

Synthesize extensive multi-engine, offline-rendered audio datasets labeled with deterministic seeds, collect frame-by-frame spectral telemetry, or train classifiers directly.

- 👉 Jump to [MIR/ML Recipes](/recipes/mir-ml)
- 👉 Check the [CLI Reference](/reference/cli)

### Computational Physicists & Mathematicians

Map numerical solutions of field equations (like the 1D diffusion equation) to frequency parameters, or read individual synthesizer voice phases to compute order parameters and analyze phase synchronization.

- 👉 Jump to [Computational Science Recipes](/recipes/comp-science)
- 👉 Check the [Datalogger Schema Reference](/reference/datalogger)

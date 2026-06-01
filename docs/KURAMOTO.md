# Kuramoto Synchronization & Order Parameter Dynamics

AnnealMusic uses a true **phase-coupled Kuramoto model** to drive the collective, emergent synchronization of its synthesis partials. Instead of independent detuning, each voice behaves as a coupled oscillator. Under strong coupling, the oscillators undergo a sharp phase transition into a locked unison state.

---

## 1. Mathematical Formulation

Each partial $i \in \{1, \dots, N\}$ is treated as a phase oscillator with an active phase $\theta_i(t) \in [0, 2\pi)$ and a fixed natural frequency $\omega_i$. The governing system of differential equations is:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N} \sum_{j=1}^{N} \sin(\theta_j - \theta_i)$$

Where:

- $\theta_i$ is the phase of the $i$-th oscillator.
- $\omega_i$ is its natural frequency.
- $K$ is the global coupling strength, scaled from the user-facing `coupling` slider (0..1) as $K = \text{coupling} \cdot 4.0$.
- $N$ is the number of active partials (density).

---

## 2. Emergent Order Parameter

The synchronization level is quantified by the complex order parameter $Z(t) = r(t) e^{i\psi(t)}$:

$$r \cdot e^{i\psi} = \frac{1}{N} \sum_{j=1}^{N} e^{i\theta_j}$$

Where:

- **$r(t) \in [0, 1]$** is the **order parameter** (synchronization magnitude):
  - $r \approx 0$: Fully incoherent, randomized phases.
  - $r \approx 1$: Tightly phase-locked, fully synchronized.
- **$\psi(t) \in [0, 2\pi)$** is the collective average phase of the system.

---

## 3. Integration Scheme (Euler–Maruyama)

We advance the phases using the **Euler–Maruyama method** to introduce a small amount of phase-noise, which keeps the synchronization transition smooth and organic:

$$\theta_i(t + dt) = \theta_i(t) + \left( \omega_i + \frac{K}{N} \sum_{j=1}^{N} \sin(\theta_j(t) - \theta_i(t)) \right) dt + \sigma_{\theta} \cdot dW_i$$

Where:

- $dt = 0.05$ (20 Hz step size).
- $\sigma_{\theta} = 0.15$ is the phase-noise scale.
- $dW_i = (\text{rng()} - 0.5) \cdot \sqrt{dt}$ is the noise step.
- All phases are wrapped into $[0, 2\pi)$ after each step.

---

## 4. Analytical Critical Coupling ($K_c$)

For a symmetric, uniformly distributed natural frequency spread $\omega_i$ between $-\text{freqSpread}$ and $+\text{freqSpread}$ ($W = 0.5$ rad/s), the critical coupling $K_c$ at which synchronization begins to emerge is analytically defined as:

$$K_c = \frac{4 W}{\pi} \approx 0.637 \text{ rad/s}$$

With our mapping $K = \text{coupling} \cdot 4.0$:

- **$K_c$ occurs at a slider value of $\text{coupling} \approx 0.16$.**
- Sweeping the `coupling` slider from $0 \dots 1.0$ covers the entire dynamic range from completely uncoupled, rich incoherent chorus ($K < 0.64$, $r < 0.3$) to a highly locked, coherent unison state ($K \gg K_c$, $r > 0.8$).

---

## 5. Audible & Visual Mapping

### Audible: Detune Contraction

To make the phase transition audible, the emergent order parameter $r(t)$ dynamically modulates the detune coupling term inside `driftStep`.
The traditional Ornstein–Uhlenbeck wander and reversion pulls partials independently. The coupling term pulls them toward the mean detune:

$$\text{couple} = K_{\text{detune}} \cdot r \cdot (\text{mean} - \text{detune}) \cdot dt$$

Where:

- $K_{\text{detune}} = 1.8$ is the detune coupling scale.
- When **uncoupled** (`coupling = 0` or $r \to 0$), the detunes walk independently under independent noise and OU reversion.
- When **synchronized** ($r \to 1$), the detunes contract rapidly into a unified unison chorus, locking the harmonic structure together.

### Audible: Spectral Fusion

Detune contraction couples $r$ to _pitch_. Spectral fusion (v9.4) couples the same order parameter to _timbre_. Each partial's coherence with the mean field, $c_i = \tfrac{1}{2}(1 + \cos(\theta_i - \psi))$, scales its amplitude:

$$g_i' = g_i \cdot \left(1 + d\,\alpha\,(c_i - \tfrac{1}{2})\right)$$

where $\alpha$ is the user-facing `fusion` amount and $d$ the reshaping depth. The mean-field identity $\frac{1}{N}\sum\cos(\theta_i-\psi) = r$ makes the bank-average gain exactly $1 + \tfrac{1}{2} d\,\alpha\, r$, so the fused harmonic energy grows in proportion to $r$ — the partials reinforce coherently as they lock, and stay diffuse when incoherent. The pure core is `src/audio/fusion.ts`; the full derivation, limits, and measured spectral results are in [DSP_THEORY.md §1.6 and §2.3](DSP_THEORY.md).

### Visual: Orbital Convergence

To represent phase locking visually, the order parameter $r$ is passed into both the Canvas 2D and WebGL renderers inside `VisualState`.
As $r \to 1$, the orbital radii of all partials converge towards the median orbit ($0.725 \cdot \text{baseR}$), bundling them together into a single, cohesive, rotating unified ring that mirrors the phase lock.

---

## 6. Structured (Heterogeneous) Coupling & Spectral Redistribution

Sections 1–5 use a **single scalar** coupling $K = \text{coupling}\cdot 4.0$ applied to every oscillator in an all-to-all mean field. Because the natural frequencies are a _symmetric_ spread, all partials lock (or drift) **together**: the per-partial coherence $c_i$ is near-uniform across $i$, so the fusion multiplier $m_i = 1 + d\,\alpha\,(c_i - \tfrac12)$ is a near-constant scalar and rescales the spectrum **uniformly** — the order parameter couples to _loudness_ but the **spectral centroid stays flat** (measured $539 \to 539$ Hz). The flatness is a property of the coupling _topology_, not of the fusion model.

### Heterogeneous coupling

Structured coupling replaces the scalar $K$ with a **per-partial coupling profile** $p_i$, so each oscillator feels its own coupling $K_i = K\cdot p_i$ to the collective field:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K_i}{N}\sum_{j=1}^{N}\sin(\theta_j - \theta_i), \qquad K_i = \text{coupling}\cdot 4.0\cdot p_i.$$

- **Homogeneous limit ($p_i = 1$):** $K_i = K$ for all $i$, recovering the scalar model **bit-identically** ($p_i = 1$ multiplies $K$ by exactly $1.0$ in IEEE-754). Every prior $r$/$\psi$, the drift/detune behavior, and all existing tests are untouched.
- **Graded profile ($p_i$ correlated with frequency):** the strongly-coupled band ($p_i \to 1$) locks tightly to the mean field ($c_i \to 1$) while the weakly-coupled band ($p_i \to 0$) keeps drifting at its natural frequency and stays incoherent ($c_i \approx \tfrac12$ on average). Now **$c_i$ correlates with partial frequency**, so the fusion multipliers $m_i$ are _no longer uniform_ — they boost one band relative to the other.

### The clustering control

A single continuous control $\text{bias}\in[-1,1]$ builds the profile as a smooth linear ramp in normalized partial index $x_i = i/(N-1)$ (low index = low frequency):

$$p_i = \begin{cases} 1 - \text{bias}\,(1 - x_i) & \text{bias} \ge 0 \quad\text{(favor high band)}\\[2pt] 1 - |\text{bias}|\,x_i & \text{bias} < 0 \quad\text{(favor low band)} \end{cases}$$

At $\text{bias}=0$ every $p_i = 1$ (homogeneous bypass); $\text{bias}>0$ locks the high band (centroid **rises**); $\text{bias}<0$ locks the low band (centroid **falls**). The ramp is continuous in both $i$ and $\text{bias}$, and $p_i\in[0,1]$ (coupling is attenuated, never amplified), so the centroid shift is a smooth, bypassable instrument control rather than a binary mode.

This is the mechanism that turns the _existing_ per-partial fusion model into genuine **spectral redistribution**: a centroid shift driven by oscillator-sync topology, not just coherent energy reinforcement. The pure core is `clusterCouplingProfile` / `kuramotoStep` in `src/audio/kuramoto.ts`; the measured centroid shift (prediction vs. measurement, both directions) is in [DSP_THEORY.md](DSP_THEORY.md).

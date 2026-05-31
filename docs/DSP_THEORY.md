# Digital Signal Processing (DSP) & Synchronization Theory in AnnealMusic

This document serves as a comprehensive, beginner-friendly guide to the advanced mathematical and digital signal processing principles underpinning **AnnealMusic**.

It focuses on two core pillars of our system:

1. **The Kuramoto Model**: The physics of coupled phase oscillators and the derivation of the emergent **Order Parameter ($r$)**.
2. **The Spectral Correctness Test Suite**: How we use Cooley-Tukey Radix-2 FFTs, parabolic interpolation, and SDE stationary variance to prove our synthesis engine matches real-world physics within $\pm 2$ cents.

---

## Part 1: Phase Oscillators & The Kuramoto Model

At its heart, AnnealMusic is a generative ambient sandbox. Instead of using independent, static synthesizers, it models pitch drift and unison through **coupled phase oscillators**.

### 1.1 What is a Phase Oscillator?

In physics, any repeating cycle (like a pendulum, a planet orbiting a star, or a sound wave) can be represented as a point moving around a circle. We can describe the position of this point using a single angle, $\theta$, called the **phase**.

- **Phase ($\theta_i$):** An angle in radians, bounded between $0$ and $2\pi$. If a wave has completed half its cycle, $\theta = \pi$ ($180^\circ$).
- **Natural Frequency ($\omega_i$):** The intrinsic speed at which the oscillator rotates when it is completely alone.

If you have $N$ independent partials (different harmonics of a sound), each with its own natural frequency $\omega_i$, their phases will walk around the circle at different speeds:

$$\frac{d\theta_i}{dt} = \omega_i$$

Over time, because their speeds are slightly different, their phases will drift apart, creating a rich, detuned, incoherent chorus.

---

### 1.2 Adding Coupling (The Governing Equation)

What if we want these oscillators to influence each other? What if they want to pull each other into a unified, locked pitch?

Yoshiki Kuramoto (1975) formulated a beautiful, elegant differential equation to model this exact phenomenon. In AnnealMusic, the governing equation for each partial $i$ is:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N} \sum_{j=1}^{N} \sin(\theta_j - \theta_i)$$

Let's break this down term-by-term:

- **$\frac{d\theta_i}{dt}$**: The instantaneous speed (frequency) of oscillator $i$ at this moment.
- **$\omega_i$**: The oscillator's preferred, natural speed.
- **$K$**: The global **coupling strength** (scaled directly from the user's `coupling` slider).
- **$N$**: The total number of active oscillators.
- **$\sin(\theta_j - \theta_i)$**: The interaction force between oscillator $j$ and oscillator $i$.

#### Why a Sine Function?

The sine function is the perfect physical "pulling" mechanism:

1. **Perfect Agreement:** If oscillator $j$ and oscillator $i$ have the exact same phase ($\theta_j - \theta_i = 0$), then $\sin(0) = 0$. No force is exerted.
2. **Pulling Ahead:** If oscillator $j$ is slightly ahead of oscillator $i$ ($0 < \theta_j - \theta_i < \pi$), then $\sin(\theta_j - \theta_i) > 0$. This positive force **speeds up** the slower oscillator $i$.
3. **Falling Behind:** If oscillator $j$ is slightly behind oscillator $i$ ($-\pi < \theta_j - \theta_i < 0$), then $\sin(\theta_j - \theta_i) < 0$. This negative force **slows down** the faster oscillator $i$.

By summing this interaction over all $N$ oscillators, every partial continuously adjusts its speed to catch up with or slow down for its neighbors.

---

### 1.3 Deriving the Kuramoto Order Parameter ($r$)

How do we measure how "synchronized" the entire system is?
We do this by treating each oscillator's phase $\theta_j$ as a unit vector on the complex plane:

$$e^{i\theta_j} = \cos(\theta_j) + i\sin(\theta_j)$$

If we plot all $N$ phases as points on a circle and average their positions, we get a single complex number $Z(t)$, which we write in polar coordinates as $r(t) e^{i\psi(t)}$:

$$r \cdot e^{i\psi} = \frac{1}{N} \sum_{j=1}^{N} e^{i\theta_j}$$

Let's dissect this **Order Parameter** $Z(t)$:

- **$r(t) \in [0, 1]$**: The **coherence factor** (synchronization magnitude).
  - If $r \approx 0$, the phases are scattered randomly all over the circle. Their vectors point in opposite directions and cancel out. The system is **disordered** (rich detuned chorus).
  - If $r \approx 1$, the phases are tightly clustered together. Their vectors point in the same direction and add up to a full radius of $1.0$. The system is **synchronized** (solid unison).
- **$\psi(t) \in [0, 2\pi)$**: The **average global phase** of the entire system (the center of mass of the cluster).

---

### 1.4 The Mean-Field Simplification (Positive Feedback Loop)

A naive calculation of the coupling force requires calculating $\sin(\theta_j - \theta_i)$ for every single pair of oscillators. For $N$ oscillators, this requires $O(N^2)$ calculations, which is very expensive for real-time DSP.

However, we can perform a spectacular algebraic simplification using our definition of $r e^{i\psi}$.

Let's multiply both sides of the order parameter equation by $e^{-i\theta_i}$:

$$r e^{i\psi} e^{-i\theta_i} = \left( \frac{1}{N} \sum_{j=1}^{N} e^{i\theta_j} \right) e^{-i\theta_i}$$

Using exponent addition rules:

$$r e^{i(\psi - \theta_i)} = \frac{1}{N} \sum_{j=1}^{N} e^{i(\theta_j - \theta_i)}$$

Now, let's expand both sides using Euler's formula ($e^{ix} = \cos x + i\sin x$):

$$r \left[ \cos(\psi - \theta_i) + i\sin(\psi - \theta_i) \right] = \frac{1}{N} \sum_{j=1}^{N} \left[ \cos(\theta_j - \theta_i) + i\sin(\theta_j - \theta_i) \right]$$

If we equate the imaginary parts (the coefficient of $i$) of both sides, we get:

$$r \sin(\psi - \theta_i) = \frac{1}{N} \sum_{j=1}^{N} \sin(\theta_j - \theta_i)$$

Substitute this back into our original governing differential equation:

$$\frac{d\theta_i}{dt} = \omega_i + K \cdot \left[ \frac{1}{N} \sum_{j=1}^{N} \sin(\theta_j - \theta_i) \right]$$

$$\frac{d\theta_i}{dt} = \omega_i + K r \sin(\psi - \theta_i)$$

#### The Physical Realization

This result is profound! It proves that **individual oscillators do not need to look at each other.** Instead:

1. Each oscillator couples exclusively to a single, global **mean field** representing the system's average phase $\psi$.
2. The effective coupling strength pulling each oscillator toward that average phase is **$K \cdot r$**.

This creates a massive **positive feedback loop**:

- As oscillators happen to drift closer together, the order parameter $r$ increases.
- As $r$ increases, the pulling force $K \cdot r$ gets stronger.
- The stronger force pulls the remaining outliers in even faster, triggering a sudden, explosive phase transition into synchronization!

---

### 1.5 Critical Coupling ($K_c$) and the Slider Mapping

In AnnealMusic, the natural frequencies $\omega_i$ are spread uniformly between $-\text{freqSpread}$ and $+\text{freqSpread}$ (width $W = 0.5$ rad/s).

Analytically, the critical coupling threshold $K_c$ where synchronization first begins to break through the noise is:

$$K_c = \frac{4 W}{\pi} \approx 0.637 \text{ rad/s}$$

We map the user-facing `coupling` slider (which goes from $0 \dots 1.0$) to $K = \text{coupling} \cdot 4.0$:

- **$K_c$ occurs at a slider value of $\text{coupling} \approx 0.16$.**
- Below $0.16$, the coupling force is too weak to overcome the natural frequency spread; oscillators drift independently.
- Above $0.16$, the system undergoes a sharp phase transition, and $r(t)$ rises rapidly toward $1.0$, collapsing the detuned chorus into a pure, locked drone.

---

## Part 2: The Spectral Correctness Test Suite

In professional audio engineering, testing a synthesizer is difficult. How do you write a unit test to prove a physical modeling string actually sounds like a string?

Standard tests can only check if the code doesn't crash or outputs numbers. AnnealMusic implements a **Spectral DSP Physics-Correctness Test Suite** (`dsp.test.ts`) that analyzes the actual frequency spectrum of the synthesized audio, asserting physical correctness within $\pm 2$ cents.

---

### 2.1 The FFT Resolution Bottleneck

To analyze the frequencies in our audio, we run a Fast Fourier Transform (FFT). An FFT takes a block of audio samples and divides the continuous frequency spectrum into a series of discrete "bins":

$$\text{Bin Width} = \frac{f_s}{N_{\text{FFT}}}$$

Where $f_s$ is the sample rate ($44,100\text{ Hz}$) and $N_{\text{FFT}}$ is the size of the FFT buffer.

Let's calculate the bin width for a standard, high-performance FFT size of $N_{\text{FFT}} = 16,384$:

$$\text{Bin Width} = \frac{44,100}{16,384} \approx 2.69\text{ Hz}$$

This means our FFT can only tell us the energy at $0\text{ Hz}$, $2.69\text{ Hz}$, $5.38\text{ Hz}$, etc.

#### Why This is a Disaster for Musical Tuning:

In music, pitch is logarithmic. A "cent" is $1/1200$th of an octave.
Let's look at the low note **A1 ($55\text{ Hz}$)**:

- A deviation of just **$2$ cents** at $55\text{ Hz}$ is only **$0.06\text{ Hz}$** ($55 \times 2^{2/1200} - 55$).
- But our FFT bins are spaced **$2.69\text{ Hz}$** apart!
- If our synthesis engine is flat by $30$ cents ($54\text{ Hz}$), the FFT will still report the peak is in the exact same bin as $55\text{ Hz}$. The measurement error is a massive $\approx 80$ cents.

To measure $2$ cents of accuracy at $55\text{ Hz}$ using raw FFT bins, we would need a bin width of $0.03\text{ Hz}$. That requires an FFT size of $N_{\text{FFT}} = 1,470,000$ samples—which would take several seconds to compute, stalling our test suites completely.

---

### 2.2 The Solution: Parabolic Peak Interpolation

To solve this, the spectral suite uses **Parabolic Peak Interpolation**.

A continuous resonance peak in a windowed spectrum doesn't just occupy one bin; it spills into neighboring bins. If we convert the magnitude spectrum into the natural logarithm (decibel) domain, the peak takes the shape of a perfect parabola.

By fitting a quadratic equation ($y = Ax^2 + Bx + C$) through the highest bin $p$ and its two immediate neighbors ($p-1$ and $p+1$), we can calculate the **exact, continuous mathematical peak** between the bins.

```
          Peak Bin (p) [Value = β]
               *
              / \
             /   \  <-- Fitted Parabolic Curve
   [Value = α]    * [Value = γ]
           *       \
          /         \
      p-1      p     p+1   (Discrete FFT Bins)
               ^
         True Peak Offset (d)
```

#### Step-by-Step Mathematical Derivation:

Let's define our three discrete points in the natural log domain relative to the peak bin center ($x = 0$):

- **$\alpha = \ln|X[p-1]|$** at $x = -1$
- **$\beta = \ln|X[p]|$** at $x = 0$
- **$\gamma = \ln|X[p+1]|$** at $x = 1$

We want to fit the quadratic parabola:

$$f(x) = A x^2 + B x + C$$

Let's plug in our three coordinates:

1. For $x = 0$:

   $$f(0) = C = \beta$$

2. For $x = -1$:

   $$f(-1) = A(-1)^2 + B(-1) + C = A - B + \beta = \alpha \implies A - B = \alpha - \beta$$

3. For $x = 1$:

   $$f(1) = A(1)^2 + B(1) + C = A + B + \beta = \gamma \implies A + B = \gamma - \beta$$

Now, we solve this system of equations for $A$ and $B$.

- **Find $A$** by adding the two equations:

  $$(A - B) + (A + B) = (\alpha - \beta) + (\gamma - \beta)$$
  $$2A = \alpha + \gamma - 2\beta \implies A = \frac{\alpha - 2\beta + \gamma}{2}$$

- **Find $B$** by subtracting the first equation from the second:

  $$(A + B) - (A - B) = (\gamma - \beta) - (\alpha - \beta)$$
  $$2B = \gamma - \alpha \implies B = \frac{\gamma - \alpha}{2}$$

The peak of a parabola $f(x) = Ax^2 + Bx + C$ is the vertex, which occurs where its derivative is zero:

$$f'(x) = 2Ax + B = 0 \implies x_{\text{peak}} = -\frac{B}{2A}$$

Let's substitute our solved values for $A$ and $B$ into this vertex formula:

$$x_{\text{peak}} = d = -\frac{\frac{\gamma - \alpha}{2}}{2 \left( \frac{\alpha - 2\beta + \gamma}{2} \right)}$$

Cancel out the common $2$ in the denominators:

$$d = 0.5 \cdot \frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}$$

#### Calculating the Precision Frequency:

The value $d$ represents the fractional bin offset (ranging between $-0.5$ and $+0.5$).
The interpolated bin index is:

$$p_{\text{interp}} = p + d$$

And the final, ultra-precise frequency is:

$$f_{\text{peak}} = p_{\text{interp}} \cdot \frac{f_s}{N_{\text{FFT}}}$$

This simple interpolation reduces our measurement error from $\approx 45\text{ cents}$ to **$< 2\text{ cents}$**, enabling extremely tight physical assertions to run instantly and deterministically.

---

### 2.3 What the Spectral Suite Asserts

Using this mathematical harness, our test suite enforces several critical laws of acoustics:

#### 1. Tuning & Microtonal Round-Trip Accuracy

- **Assertion:** Driving a physical waveguide or a Karplus-Strong string at a target frequency $f_0$ must produce a fundamental frequency peak within **$\pm 2$ cents** of that target.
- **Why it matters:** Proves that our fractional-delay line interpolation algorithms are physically accurate across standard pitches and non-12-TET just-intonation microtonal systems (e.g. 7-limit just intonation E4 at $\approx 321.75\text{ Hz}$).

#### 2. Lorentzian Resonator Bandwidth ($Q$ and Damping)

Our `ModalBank` (used for stiff plates, membranes, and metal bars) is built from biquad bandpass resonators. We tune their resonance Quality Factor ($Q$) based on user damping:

$$Q = 8 + (1 - \text{damping}) \cdot 240$$

- **Assertion:** The theoretical $-3\text{ dB}$ bandwidth ($\Delta f$) of a resonator must match its measured physical decay spectrum:

  $$\Delta f = \frac{f_0}{Q}$$

- **Why it matters:** The harness excites the metal plates with a single digital pluck impulse, records the decay, measures the width of the resulting spectral peak, and asserts that lower damping increases $Q$ (narrowing the bandwidth) by the exact physical factor.

#### 3. Stochastic SDE Stationary Variance

To simulate organic pitch drift, AnnealMusic uses the **Ornstein–Uhlenbeck (OU) SDE**:

$$dx_t = -\theta x_t dt + \sigma dW_t$$

Where $\theta = 0.25$ is the speed of mean reversion, $\sigma$ is the noise scale, and $dW_t$ is a random walk step.
Because we integrate this SDE numerically using the Euler–Maruyama scheme, and our random number generator $(R - 0.5)$ has a variance of $1/12$, the discrete step has an effective noise amplitude of $\tilde{\sigma} = \sigma / \sqrt{12}$.

The continuous, analytical stationary variance of this system is:

$$\text{Var}_{\text{stationary}} = \frac{\tilde{\sigma}^2}{2\theta} = \frac{\sigma^2}{24\theta}$$

- **Assertion:** For a standard user drift setting of $0.5$ ($\sigma = 9$ cents), the theoretical variance is exactly $13.5\text{ cents}^2$.
- **Why it matters:** The suite runs a long, deterministic, seeded simulation ($10,000$ steps), discards the warm-up transient, and asserts that the empirical variance of the pitch drift matches $13.5\text{ cents}^2$ within a tiny tolerance of **$\pm 0.5\text{ cents}^2$**.

#### 4. Harmonicity and Helmholtz Sustain

- **Assertion:** Driving a bowed string (sustained Helmholtz stick-slip motion) must produce a significantly richer harmonic spectrum (higher measured **Spectral Centroid**) than a plucked string (decaying impulse), and its higher partial peaks must form an exact integer series $k \cdot f_0$ within tight bounds.
- **Why it matters:** Proves our physical modeling of the bowed string successfully achieves self-sustained non-linear oscillation rather than decaying into simple filtered noise.

#### 5. Waveguide Physical Limitations

- **Assertion:** Verifies that at very high frequencies (e.g. $> 1600\text{ Hz}$), the cumulative phase delay of our loop low-pass filters causes physical waveguide models to run slightly flat ($> 0.2\text{ cents}$ flat).
- **Why it matters:** This test documents the physical limitations of integer-based delay lines, ensuring that future improvements in fractional-delay interpolation are measurable and visible.

---

## Summary of Mathematics

| Concept                      | Equation                                                                   | Physical Purpose                                     |
| :--------------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------- |
| **Kuramoto Phase Model**     | $\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N}\sum\sin(\theta_j-\theta_i)$ | Models phase pulling between synthesis partials      |
| **Order Parameter ($r$)**    | $r e^{i\psi} = \frac{1}{N}\sum e^{i\theta_j}$                              | Measures phase coherence (synchronization index)     |
| **Mean-Field Pull**          | $\frac{d\theta_i}{dt} = \omega_i + K r \sin(\psi - \theta_i)$              | Allows fast $O(N)$ real-time coupling in Web Audio   |
| **Peak Interpolation ($d$)** | $d = 0.5 \cdot \frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}$           | Achieves sub-bin FFT frequency precision $< 2$ cents |
| **Lorentzian Bandwidth**     | $\Delta f = f_0 / Q$                                                       | Asserts physical biquad damping and decay rates      |
| **OU Drift Variance**        | $\text{Var} = \sigma^2 / (24\theta) = 13.5\text{ cents}^2$                 | Verifies statistical limits of organic pitch drift   |

# AnnealMusic - DSP Physics-Correctness Test Suite

This document outlines the architecture, mathematical principles, and usage of the **Spectral DSP Physics-Correctness Test Suite** in AnnealMusic. These tests elevate the verification of the synthesis engines from basic stability checks ("does it not crash or produce NaNs") to rigorous proofs of theoretical physical correctness.

---

## 1. Core Harness Architecture

The spectral test harness runs entirely offline, with zero dependencies on the Web Audio API or browser `AudioContext`. The pipeline operates as follows:

```
[Pure DSP Class] ──(renderDSP)──> [Raw Samples] ──(Hann Window)──> [Windowed Samples]
                                                                        │
[Interpolated Frequencies] <──(Parabolic Interpolation) <──(FFT) <──(Zero-Pad 2x-16x)
```

1. **Offline Render:** Pull $N$ samples from a pure DSP class (e.g. `ModalBank`, `KarplusStrong`) using its standard `render()` or `next()` loop.
2. **Hann Windowing:** Apply a Hann window $w[n] = 0.5 \cdot (1 - \cos(2\pi n / (N-1)))$ to suppress spectral leakage side-lobes.
3. **Zero Padding:** Zero-pad the buffer to a larger power-of-2 size (e.g., $8\times$ or $16\times$) to interpolate the frequency bin centers.
4. **Radix-2 FFT:** Run our custom, zero-dependency Radix-2 Cooley-Tukey Fast Fourier Transform.
5. **Magnitude Spectrum:** Compute the linear magnitude $|X[k]| = \sqrt{\text{Re}^2 + \text{Im}^2}$ and decibel level $20\log_{10}(|X[k]| + 1e-9)$ for the first half of the FFT (0 to $N/2$).
6. **Parabolic Peak Interpolation:** Resolve sub-bin peak frequencies with ultra-high precision.

---

## 2. Mathematical Principles

### Parabolic Peak Interpolation
To achieve sub-bin frequency accuracy without requiring excessively large FFT sizes, the harness fits a parabola through the peak bin $p$ and its adjacent bins $p-1$ and $p+1$ in the decibel domain:

$$\alpha = \ln|X[p-1]|, \quad \beta = \ln|X[p]|, \quad \gamma = \ln|X[p+1]|$$

The peak offset $d$ from bin center $p$ is derived as:

$$d = 0.5 \cdot \frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}$$

The interpolated bin index is $p_{\text{interp}} = p + d$, and the final sub-bin frequency is:

$$f_{\text{peak}} = p_{\text{interp}} \cdot \frac{f_s}{N_{\text{FFT}}}$$

This reduces frequency measurement errors from $\approx 45$ cents to **$< 3$ cents**, allowing tight physical assertions to run deterministically.

### Damping to Q / Bandwidth Verification
The biquad bandpass resonators in the `ModalBank` are tuned to a quality factor $Q$ based on damping:

$$Q = 8 + (1 - \text{damping}) \cdot 240$$

For a single-mode resonator at frequency $f_0$, the theoretical $-3\text{ dB}$ bandwidth is:

$$\Delta f = \frac{f_0}{Q}$$

The harness excites a single resonator with a brief pluck impulse, measures its $-3\text{ dB}$ bandwidth from the noise-free Lorentzian decay spectrum, and asserts that lower damping increases $Q$ (narrowing the bandwidth) by the exact theoretical factor.

### Ornstein-Uhlenbeck SDE Stationary Variance
The stochastic Ornstein-Uhlenbeck drift SDE:

$$dx_t = -\theta x_t dt + \sigma dW_t$$

is integrated via the Euler-Maruyama scheme. Since the uniform noise $(R - 0.5)$ has a variance of $1/12$, the discrete step has effective noise amplitude $\tilde{\sigma} = \sigma / \sqrt{12}$. The continuous analytical stationary variance is:

$$\text{Var}_{\text{stationary}} = \frac{\tilde{\sigma}^2}{2\theta} = \frac{\sigma^2}{24\theta}$$

For $\theta = 0.25$ and $\text{drift} = 0.5$ ($\sigma = 9$), the analytical variance is exactly $13.5\text{ cents}^2$. The harness runs a long seeded simulation, discards the initial warm-up transient, and asserts that the empirical variance converges to $13.5$ within $\pm 0.5\text{ cents}^2$.

---

## 3. Physical DSP Assertions & Tolerances

The suite asserts the following rules:
* **Modal Bank Eigenfrequency Ratios:** Stiff Plate ($\sqrt{1 + B n^2}$), Membrance (Bessel zeros), Bell (hum, prime, tierce, nominal), and Mallet bar modes must match their corresponding theoretical `eigen` functions within $\pm 45$ cents (accounting for tight mode spacing and absolute frequency).
* **Karplus-Strong Harmonicity:** Driving the string at $f_0$ must produce a clean harmonic series ($k \cdot f_0$) within $\pm 35$ cents.
* **Integer Delay High-Frequency Limitation:** At high frequencies (e.g. $1600\text{ Hz}$), the phase delay of the loop low-pass filter makes the pitch run flat. The test asserts that the flat deviation is measurable ($> 0.2$ cents flat) and documents this waveguide limitation (to be corrected in subsequent tracks).
* **Centroid Brightness Shift:** Raising the `brightness` parameter must monotonically shift the spectral centroid higher.

---

## 4. How to Add a Spectral Test for a New Engine

To verify a new physical engine (e.g. a new waveguide or multi-resonator config):

1. **Verify offline render compatibility:** Ensure your new DSP class exposes a sample-by-sample `next(): number` or block-based `render(out: Float32Array)` method that accepts a sample rate and parameters in its constructor.
2. **Add a test block in `src/audio/analysis/__tests__/spectral.test.ts`:**
   ```typescript
   describe('MyNewEngine Physics', () => {
     it('proves target resonant frequency', () => {
       const dsp = new MyNewEngine(SR, { f0: 440, ... });
       
       // Pluck excitation to clear noise floor
       dsp.setExcitation(1.0);
       for (let i = 0; i < 150; i++) dsp.next();
       dsp.setExcitation(0.0);
       
       // Render and transform
       const samples = renderDSP(dsp, 2048);
       const windowed = applyHannWindow(samples);
       const { real, imag } = computeFFTSpectrum(windowed, 16);
       const mags = getMagnitudeSpectrum(real, imag);
       
       const peaks = peakFrequencies(mags, SR, 32768, { maxPeaks: 1, minDb: -50 });
       expect(peaks[0]!.frequency).toBeCloseTo(440, 1.0); // Within ~4 Hz
     });
   });
   ```
3. **Execute:** Run `npm test` to verify your physics-correctness test runs green!

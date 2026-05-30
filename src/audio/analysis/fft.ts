/**
 * Pure TypeScript Cooley-Tukey Radix-2 Fast Fourier Transform (FFT).
 * Sized to power of 2, operates in-place on Float32Arrays representing real and imaginary parts.
 *
 * Sourced/designed for zero external dependencies, performance, and deterministic DSP assertions.
 */

/**
 * Computes the forward FFT in-place.
 * @param real Real part of the input/output array. Length must be a power of 2.
 * @param imag Imaginary part of the input/output array. Must be the same length as real.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (imag.length !== n) {
    throw new Error('Real and imaginary arrays must have the same length');
  }
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of 2');
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tempR = real[i];
      const tempI = imag[i];
      if (tempR !== undefined && tempI !== undefined) {
        const rJ = real[j];
        const iJ = imag[j];
        if (rJ !== undefined && iJ !== undefined) {
          real[i] = rJ;
          imag[i] = iJ;
          real[j] = tempR;
          imag[j] = tempI;
        }
      }
    }
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
  }

  // Cooley-Tukey Decimation-in-Time
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const tabStep = (2 * Math.PI) / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = -k * tabStep;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);

        const oddIdx = i + k + halfSize;
        const evenIdx = i + k;

        const rOdd = real[oddIdx];
        const iOdd = imag[oddIdx];
        const rEven = real[evenIdx];
        const iEven = imag[evenIdx];

        if (
          rOdd !== undefined &&
          iOdd !== undefined &&
          rEven !== undefined &&
          iEven !== undefined
        ) {
          // Complex multiplication: odd * W
          const tr = rOdd * wr - iOdd * wi;
          const ti = rOdd * wi + iOdd * wr;

          real[oddIdx] = rEven - tr;
          imag[oddIdx] = iEven - ti;
          real[evenIdx] = rEven + tr;
          imag[evenIdx] = iEven + ti;
        }
      }
    }
  }
}

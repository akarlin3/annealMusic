import anneal
import time
import matplotlib.pyplot as plt

print("Running Spectral Evolution Analysis...")
anneal.datalog.start("full")
time.sleep(0.5)

# Capture current active spectrum from DSP engine
spec = anneal.engine.get_spectrum()
print(f"Retrieved magnitude spectrum of shape: {spec.shape}")

# Plot magnitude spectral values
plt.figure(figsize=(6, 3))
plt.plot(spec, color='orange', label='FFT Spectrum')
plt.xlabel('Frequency Bin index (512 total)')
plt.ylabel('Magnitude (linear decibel offset)')
plt.title('Synthesizer Instantaneous FFT Spectrum')
plt.grid(True)
plt.legend()
plt.show()

anneal.datalog.stop()
print("Spectral Analysis Complete ✅")

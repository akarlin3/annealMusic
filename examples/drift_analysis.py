import anneal
import time
import matplotlib.pyplot as plt

print("Starting Session Datalogger Coherence Analysis...")
anneal.datalog.start("standard")

# Inject micro-drifts slowly
for i in range(10):
    val = 0.2 + (i * 0.05)
    anneal.state.set({"drift": val, "brightness": 0.3 + (i * 0.04)})
    print(f"Set: drift={val:.2f}")
    time.sleep(0.1)

# Ingest into pandas
df = anneal.session_log(last_seconds=5)
print(f"Captured {len(df)} ticks into pandas DataFrame.")

if not df.empty:
    # Plot order parameter over time
    plt.figure(figsize=(6, 3))
    plt.plot(df['timestamp'], df['drift.orderParameter'], label='Coherence r(t)', color='orange')
    plt.xlabel('Session Audio Time (s)')
    plt.ylabel('Order Parameter r(t)')
    plt.title('Kuramoto Coupling Coherence Drift')
    plt.grid(True)
    plt.legend()
    plt.show()

anneal.datalog.stop()
print("Analysis Complete ✅")

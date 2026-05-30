import anneal
import asyncio

async def run_sweep():
    print("Initiating Asynchronous Parameter Grid Sweep...")
    
    # Grid of drift coupling vs brightness
    grid = {
        "drift": [0.1, 0.5, 0.9],
        "brightness": [0.3, 0.7]
    }
    
    # Run the grid sweep (each combination runs for 1.0 second)
    df = await anneal.sweep(grid, duration=1.0)
    print("\nSweep Results Matrix:")
    print(df[['drift', 'brightness', 'rms_mean', 'order_parameter_mean']])
    
    # Save sweep matrix to virtual filesystem
    df.to_csv('/tmp/sweep_results.csv', index=False)
    print("CSV matrix saved to MEMFS: /tmp/sweep_results.csv ✅")

# Run async sweep inside worker event loop
asyncio.ensure_future(run_sweep())

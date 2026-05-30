# 1D Diffusion (Heat) Equation Sonifier for AnnealMusic
# Maps discrete concentrations to frequency and drift parameters

import anneal
import numpy as np
import asyncio

# Setup Grid parameters
nx = 50
dx = 0.1
alpha = 0.01 # Diffusion rate
dt = 0.05

# Local hot spot center spike
u = np.zeros(nx)
u[nx//2 - 5 : nx//2 + 5] = 1.0

async def solve_and_sonify():
    global u
    print("[INFO] Initiating Numerical Solver Sonification...")
    for step in range(500):
        # Finite difference calculation
        u_new = u.copy()
        for i in range(1, nx-1):
            u_new[i] = u[i] + alpha * dt / (dx**2) * (u[i+1] - 2*u[i] + u[i-1])
        u = u_new
        
        # Calculate field variables
        mean_temp = np.mean(u)
        max_temp = np.max(u)
        spread = np.std(u)
        
        # Map values to synth sliders
        patch = {
            "rootFreq": 110.0 + (mean_temp * 440.0),
            "drift": min(1.0, max_temp),
            "coupling": 1.0 - min(1.0, spread)
        }
        anneal.state.set(patch)
        
        await asyncio.sleep(0.05) # 20Hz ticks

# Start solver loop
asyncio.ensure_future(solve_and_sonify())

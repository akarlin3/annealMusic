# Brownian Parameter Random Walk for AnnealMusic
# Walks coupling and brightness slowly through physical boundaries

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
        
        # Update engine parameters
        anneal.state.set({
            "coupling": coupling,
            "brightness": brightness
        })
        
        await asyncio.sleep(0.1) # 10Hz updates

# Start walk execution
asyncio.ensure_future(brownian_walk())

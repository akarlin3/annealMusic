import anneal
import asyncio

async def pilot():
    print("Triggering Perceptual Stem Synthesis Render...")
    
    # Render 3 seconds of stem audio directly inside the sandbox as a numpy array
    audio = await anneal.render(duration=3.0, format='numpy')
    print(f"Rendered NumPy Audio Shape: {audio.shape} (Stereo, {audio.shape[1]} samples)")
    
    # Render to WAV file on virtual disk (/tmp/perceptual_bloom.wav)
    print("Writing 16-bit PCM WAV to MEMFS...")
    await anneal.render(duration=3.0, format='wav', path='/tmp/perceptual_bloom.wav')
    print("WAV stem compiled: /tmp/perceptual_bloom.wav ✅")

# Run async pilot in Pyodide event loop
asyncio.ensure_future(pilot())

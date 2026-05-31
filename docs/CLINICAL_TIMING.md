# AnnealMusic Clinical Stimulus Timing & Precision Reference

Scientific presentation of stimuli relies on precise timing synchronization. This document provides an honest analysis of browser runtime constraints, sound card hardware latencies, and real-time scheduling boundaries under **AnnealMusic v7.2**.

---

## 1. Web Audio API Real-time Threading Architecture

Standard browser JavaScript operates on a single main UI thread. This thread is subject to garbage collection pauses, CSS layouts, and DOM rendering, which can delay timer callbacks (`setTimeout`, `setInterval`) by upwards of **10ms to 50ms**. Such jitter is scientifically unacceptable for stimulus onset triggers.

To achieve sub-millisecond clinical precision, AnnealMusic bypasses JS timers for audio scheduling:

```
[Main Thread] -- (User Gesture) --> [Create AudioContext]
                                              |
[Main Thread] -- (setValueAtTime) --> [Audio Engine Audio Thread (C++)]
                                              |
                                      [Sample-accurate DSP rendering]
                                              |
                                   (sub-millisecond alignment)
```

1. **Audio Thread (High Priority):** Web Audio events scheduled using native parameter node methods (e.g. `setValueAtTime`) are queued on a separate, dedicated high-priority system thread.
2. **Sample-Accurate Scheduling:** The browser's native audio thread schedules gains and sound parameter ramps relative to the `AudioContext.currentTime` clock at sample-accurate boundaries.

---

## 2. Hard Hardware Latency Floors

While internal event scheduling yields sub-millisecond precision, researchers must account for **Hardware Output Latency** floors before sound physically escapes the speaker or headphones:

1. **Sound Card Buffer Sizes:** Operating systems deliver audio samples to physical hardware in packets (buffers), usually sized at 128, 256, or 512 frames.
   - At a standard sample rate of 48,000 Hz, a 256-frame buffer introduces a **5.3ms latency floor**.
2. **System Audio Drivers:** OS mixer components (e.g., Windows WASAPI, macOS CoreAudio, iOS/Android HAL) add an additional 3ms to 12ms of driver delay.
3. **Hard Floor Summary:**
   - **macOS / iOS (CoreAudio):** Hard floor of **8ms to 15ms**.
   - **Windows (WASAPI Shared):** Hard floor of **12ms to 25ms**.
   - **Android (Oboe / AAudio):** Hard floor of **10ms to 40ms**.

---

## 3. Telemetry Timing Reports & Jitter Tracking

To audit delivery precision post-hoc, the `timing_report` logs real-time offsets during comfort check triggers:

- **Internal Latency Measurement:** Registers the exact deviation between the scheduled onset clock (`AudioContext.currentTime`) and the visual browser frame callbacks (`performance.now()`).
- **Jitter Verification:** Measures scheduled target vs actual execution times. Any event exceeding a **1ms deviation threshold** is tagged as high-jitter, alerting researchers to background system load during stimulus delivery.

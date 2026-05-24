# Live Input Guide

A short guide to wiring up an instrument so it blends into the AnnealMusic field.

## Use headphones

This is the one rule that matters. Monitoring is **off by default**, and the
field is best heard on headphones. If you turn monitoring on while listening
through speakers, the mic will pick up the speakers and feed back. Headphones
solve this completely.

## Wiring options

- **Bass / guitar via audio interface (recommended).** Plug the instrument into a
  DI or audio interface (e.g. a USB interface or pocket interface), connect the
  interface to your computer, and select it in the Input panel's **Device**
  picker. A clean DI signal hits the engine best.
- **Guitar/bass amp with a line/USB out.** Connect the amp's line or USB output
  to your computer and pick that device.
- **Microphone.** Any built-in or USB mic works — great for voice or for mic'ing
  an acoustic instrument or amp. Expect more room sound than a DI.

## Setup steps

1. Connect your interface/mic **before** opening the page (so it shows up in the
   device list with a real label after you grant permission).
2. Click **Connect input** and allow microphone access when the browser asks.
3. Pick your device in the **Device** dropdown.
4. Play and watch the **level meter**. Aim for the meter dancing in the
   upper-middle — if the red **clip** marker flashes, lower **Input Level** (or
   your interface's gain).
5. Leave **Monitoring off** unless you're on headphones.

## Notes

- Browser audio "cleanup" (echo cancellation, noise suppression, auto gain) is
  **disabled** so your signal reaches the engine clean. That means no automatic
  noise reduction — a quiet room and good gain staging help.
- The **latency** readout is an estimate of output-pipeline delay. If you're
  playing along to the field, nudge your timing slightly early to compensate.
- Input is **local only** — it's processed in your browser and never uploaded,
  saved, or included in a shared link.
- Stereo devices are summed to mono (v0.5 is a single routed voice).

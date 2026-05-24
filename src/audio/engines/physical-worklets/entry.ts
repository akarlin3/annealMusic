/**
 * Worklet bundle entry. The three processors are built into a single
 * self-contained classic worklet script (`public/worklets/physical.js`) by
 * `vite.worklet.config.ts`, so `audioWorklet.addModule` needs no module support
 * and the shared DSP (incl. the one noise utility) is bundled exactly once.
 *
 * This file is never imported by the app — only by the worklet build.
 */
import '@/audio/engines/physical-worklets/string-processor';
import '@/audio/engines/physical-worklets/tube-processor';
import '@/audio/engines/physical-worklets/plate-processor';

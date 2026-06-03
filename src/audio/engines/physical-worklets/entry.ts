/**
 * Worklet bundle entry. All eight sub-model processors are built into a single
 * self-contained classic worklet script (`public/worklets/physical.js`) by
 * `vite.worklet.config.ts`, so `audioWorklet.addModule` needs no module support
 * and the shared DSP (the noise utility + the one generalized `ModalBank`) is
 * bundled exactly once. One `addModule` registers all eight processors; switching
 * sub-models is a pure in-engine rebuild, never a new module load.
 *
 * This file is never imported by the app — only by the worklet build.
 */
import '@/audio/engines/physical-worklets/string-processor';
import '@/audio/engines/physical-worklets/tube-processor';
import '@/audio/engines/physical-worklets/plate-processor';
import '@/audio/engines/physical-worklets/membrane-processor';
import '@/audio/engines/physical-worklets/bowed-processor';
import '@/audio/engines/physical-worklets/mallet-processor';
import '@/audio/engines/physical-worklets/edge-processor';
import '@/audio/engines/physical-worklets/bell-processor';
import '@/audio/engines/physical-worklets/pulse-processor';

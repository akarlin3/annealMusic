import type { StemRenderConfig } from './StemRenderer';
import type { StemDef } from './StemTaps';

/**
 * Generates the structured `session.json` manifest describing the session parameters,
 * patch configuration, and stem definitions.
 */
export function generateManifest(
  config: StemRenderConfig,
  activeStems: StemDef[],
): string {
  const manifest = {
    appName: 'AnnealMusic',
    version: '1.5.0',
    timestamp: new Date().toISOString(),
    seed: config.seed,
    renderConfig: {
      mode: config.mode,
      arcId: config.arcId || null,
      durationSec: config.durationSec,
      sampleRate: config.sampleRate,
      bitDepth: config.bitDepth,
      bpm: 0, // freely-timed / freely floating
    },
    patchState: {
      engineId: config.engineId,
      params: config.params,
      engineParams: config.engineParams,
      loopConfig: config.loopConfig,
    },
    stems: activeStems.map((s) => ({
      id: s.id,
      label: s.label,
      channels: s.channels === 1 ? 'mono' : 'stereo',
      isFx: s.isFx,
      type: s.type,
      slotId: s.slotId || null,
      partialIndex: s.partialIndex !== undefined ? s.partialIndex : null,
      fileName: `${s.id}.wav`,
    })),
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Generates the user-friendly `README.txt` detailing how to import stems
 * and map them in standard DAWs.
 */
export function generateReadme(patchTitle: string, patchHash: string): string {
  return `========================================================================
AnnealMusic v1.5.0 · DAW Stem Export
========================================================================

Patch: ${patchTitle} (#${patchHash})
Generated: ${new Date().toLocaleString()}

Thank you for exporting your session! This archive contains the high-fidelity
multi-stem render of your ambient sandbox patch. Each stem has been rendered 
deterministically, time-aligned to sample-accuracy at t=0, and embedded with 
professional Broadcast Wave Format (BWF) and iXML metadata.

------------------------------------------------------------------------
DAW Import Instructions
------------------------------------------------------------------------
1. Open your DAW (Logic Pro, Ableton Live, Pro Tools, Reaper, FL Studio, etc.).
2. Set your DAW project's sample rate to match this export's sample rate.
3. Set your project tempo to "Freely Timed" (Tempo: freely-timed / freely floating).
4. Create a set of tracks matching the stems in this archive.
5. Drag and drop all WAV files from this folder directly onto the start (t=0)
   of separate tracks in your project timeline.
6. Press play! Because all stems are sample-accurately aligned to t=0, they 
   will play back in perfect synchronization, matching the master mix exactly.

------------------------------------------------------------------------
File Reference
------------------------------------------------------------------------
- master.wav      : Complete master mix (Full mixed post-fx session)
- engine.wav      : Raw engine synthesis output (before post-fx filter/reverb)
- engine-fx.wav   : Active engine output routed through post-fx
- loop-[X].wav    : Raw captured loop slot X (post per-slot frozen grain shaping)
- loop-[X]-fx.wav : Captured loop slot X processed through post-fx filter/reverb
- README.txt      : This instructional file
- session.json    : Structured JSON file containing exact patch configurations

Enjoy producing!
- The AnnealMusic Team
========================================================================
`;
}

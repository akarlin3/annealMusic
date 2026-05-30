/**
 * hapticBridge — thin wrapper over `@capacitor/haptics` for the optional mobile
 * breath cue (v4.4). On the web it is a no-op: the Capacitor module is imported
 * lazily and guarded by `Capacitor.isNativePlatform()`, so web bundles never run
 * native code and the feature degrades silently. Haptics are off by default and
 * only meaningful on a native (iOS/Android) build.
 */
import { Capacitor } from '@capacitor/core';
import type { BreathPhase } from './BreathController';

/** True only on a native Capacitor platform that can vibrate. */
export function isHapticsAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Fire a gentle impact at a breath phase transition. The two "active" phases
 * (inhale/exhale) get a light tap; holds get the lightest available. Web → no-op.
 * Errors (e.g. plugin missing) are swallowed so a missing haptic never breaks
 * the visual.
 */
export async function pulsePhaseTransition(phase: BreathPhase): Promise<void> {
  if (!isHapticsAvailable()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const style =
      phase === 'inhale' || phase === 'exhale'
        ? ImpactStyle.Light
        : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch {
    // Plugin unavailable or call failed — silently ignore.
  }
}

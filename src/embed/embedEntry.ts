/**
 * Standalone entry for the embed bundle (separate Vite input — never imports the
 * main app, the orchestrator, or any engine, so it stays tiny). Reads the patch
 * slug from the `/embed/<slug>` path and the `?theme=` query, then mounts the
 * minimal player.
 */
import { configFromLocation, mountEmbed } from '@/embed/embedApp';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const root = document.getElementById('embed-root');
if (root) {
  void mountEmbed(root, configFromLocation(window.location, API_BASE));
}
